const fs = require('fs')
const path = require('path')

const infile = path.join(__dirname, '..', 'ptemp.sql')
const outfile = path.join(__dirname, '..', 'ptemp_processed.sql')

const normalize = (raw) => {
  if (!raw) return ''
  return String(raw).replace(/^\s*[`'"\[]?/, '').replace(/[`'"\]]*\s*$/, '')
}

const extractMainTable = (stmt, kind) => {
  let re
  switch (kind) {
    case 'create': re = /create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(,;]+)/i; break
    case 'insert': re = /insert\s+(?:into\s+)?([^\s(,;]+)/i; break
    case 'delete': re = /delete\s+from\s+([^\s(,;]+)/i; break
    case 'truncate': re = /truncate\s+table\s+([^\s(,;]+)/i; break
    case 'drop': re = /drop\s+table\s+(?:if\s+exists\s+)?([^\s(,;]+)/i; break
    case 'select': return []
    default: return null
  }
  const m = stmt.match(re)
  if (!m) return null
  return normalize(m[1])
}

const extractFromAndJoins = (stmt) => {
  const res = []
  const re = /(?:from|join)\s+([^\s,;()]+)/gi
  let m
  while ((m = re.exec(stmt)) !== null) res.push(normalize(m[1]))
  return res
}

const mkLastSegment = (full) => {
  if (!full) return ''
  const parts = full.split('.')
  return parts[parts.length - 1]
}

const replaceTableOccurrence = (stmt, originalFull, toReplace) => {
  if (!originalFull) return stmt
  const escaped = originalFull.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  if (originalFull.indexOf('.') === -1) {
    // unqualified names: avoid replacing already ptemp-prefixed names
    const re = new RegExp(`(?<!ptemp\.)\b${escaped}\b`, 'gi')
    return stmt.replace(re, toReplace)
  }
  // qualified names: ensure we match the full token and not substrings (e.g. avoid matching
  // 'risk_test_final' inside 'risk_test_final_fk'). Use lookarounds to require non-word
  // character boundaries around the match.
  const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'gi')
  return stmt.replace(re, toReplace)
}

const processText = (text) => {
  if (!text) return { output: '', summary: 'empty' }

  const cleaned = text.split(/\r?\n/).filter(l => !/^\s*@/.test(l)).join('\n')

  const stmtRegex = /([\s\S]*?;)/g
  const stmts = []
  let match
  let lastIndex = 0
  while ((match = stmtRegex.exec(cleaned)) !== null) {
    stmts.push(match[1])
    lastIndex = stmtRegex.lastIndex
  }
  if (lastIndex < cleaned.length) stmts.push(cleaned.slice(lastIndex))

  const tableMap = {}
  const markTable = (full, kind) => {
    if (!full) return
    const last = mkLastSegment(full)
    if (!tableMap[last]) tableMap[last] = { last, fullNames: new Set(), repFull: full, hasCreate: false, hasMod: false, hasSelectJoin: false }
    tableMap[last].fullNames.add(full)
    if (!tableMap[last].repFull || (tableMap[last].repFull.indexOf('.') === -1 && full.indexOf('.') !== -1)) tableMap[last].repFull = full
    if (kind === 'create') tableMap[last].hasCreate = true
    if (kind === 'mod') tableMap[last].hasMod = true
    if (kind === 'select') tableMap[last].hasSelectJoin = true
  }

  for (const s of stmts) {
    const create = extractMainTable(s, 'create')
    if (create) markTable(create, 'create')
    const insert = extractMainTable(s, 'insert')
    if (insert) markTable(insert, 'mod')
    const del = extractMainTable(s, 'delete')
    if (del) markTable(del, 'mod')
    const trunc = extractMainTable(s, 'truncate')
    const drop = extractMainTable(s, 'drop')
    if (trunc) markTable(trunc, 'mod')
    if (drop) markTable(drop, 'mod')
    const froms = extractFromAndJoins(s)
    for (const f of froms) markTable(f, 'select')
  }

  const historySet = new Set(), type1 = new Set(), type2 = new Set(), readonly = new Set()
  for (const last in tableMap) {
    const info = tableMap[last]
    if (/[_]dt$/i.test(last)) { historySet.add(last); continue }
    if (info.hasMod) { if (info.hasCreate) type2.add(last); else type1.add(last); continue }
    if (info.hasSelectJoin && !info.hasCreate && !info.hasMod) readonly.add(last)
  }

  const inited = new Set()
  const output = []

  for (const s of stmts) {
    let cur = s
    // First, replace any occurrences (including FROM/JOIN) of all type1/type2 tables
    // so references to modified tables are rewritten everywhere.
    for (const lastKey of [...type1, ...type2]) {
      if (!lastKey) continue
      if (historySet.has(lastKey)) continue
      const repl = `ptemp.${lastKey}`
      const info = tableMap[lastKey]
      if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
      cur = replaceTableOccurrence(cur, lastKey, repl)
    }
    const isInsert = /\binsert\b/i.test(s)
    const isDelete = /\bdelete\b/i.test(s)
    const isTrunc = /\btruncate\b/i.test(s)
    const isCreate = /\bcreate\b\s+table\b/i.test(s)

    const mainInsert = extractMainTable(s, 'insert')
    const mainDelete = extractMainTable(s, 'delete')
    const mainTrunc = extractMainTable(s, 'truncate')
    const mainCreate = extractMainTable(s, 'create')

    const mainDrop = extractMainTable(s, 'drop')
    const dmlTarget = mainInsert || mainDelete || mainTrunc || mainDrop
    if (dmlTarget) {
      const lastKey = mkLastSegment(dmlTarget)
      // if this is a non-DROP DML targeting a history table, skip it
      if (!mainDrop && historySet.has(lastKey)) continue

      const ADD_INIT = (process.env.ADD_INIT || 'true').toLowerCase() !== 'false'

      const handleModTarget = (lastKey) => {
        if (!lastKey) return null
        if (historySet.has(lastKey)) return 'SKIP_HISTORY'
        if (type1.has(lastKey) || type2.has(lastKey)) {
          const ptempName = `ptemp.${lastKey}`
          if (ADD_INIT && type1.has(lastKey) && !inited.has(lastKey)) {
            const dropLine = `drop table if exists ${ptempName};\n`
            const repFull = tableMap[lastKey] && tableMap[lastKey].repFull ? tableMap[lastKey].repFull : lastKey
            const createLike = `create table ${ptempName} like ${repFull};\n`
            output.push(dropLine + createLike)
            inited.add(lastKey)
          }
          return ptempName
        }
        return null
      }

      const repl = handleModTarget(lastKey)
      if (repl === 'SKIP_HISTORY') continue
      if (repl) {
        const info = tableMap[lastKey]
        if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
        cur = replaceTableOccurrence(cur, lastKey, repl)
      }
    }

    if (isCreate && mainCreate) {
      const lastKey = mkLastSegment(mainCreate)
      if (type2.has(lastKey)) {
        const repl = `ptemp.${lastKey}`
        const info = tableMap[lastKey]
        if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
        cur = replaceTableOccurrence(cur, lastKey, repl)
      }
    }

    output.push(cur)
  }

  const result = output.join('')
  return { output: result, summary: { type1: type1.size, type2: type2.size, readonly: readonly.size, history: historySet.size } }
}

// run
const txt = fs.readFileSync(infile, 'utf-8')
const { output, summary } = processText(txt)
fs.writeFileSync(outfile, output, 'utf-8')
console.log('Processing done. Summary:', summary)
console.log('Wrote processed file to', outfile)
