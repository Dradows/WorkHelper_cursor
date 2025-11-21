import React, { useState } from 'react'
import './SqlProcessor.css'

// Basic SQL statement parser that respects quotes and returns statements (without trailing semicolon)
const parseStatements = (sql) => {
  const stmts = []
  let buf = ''
  let inSingle = false
  let inDouble = false
  let inBacktick = false
  let prev = ''
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle
    if (ch === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble
    if (ch === '`' && prev !== '\\' && !inSingle && !inDouble) inBacktick = !inBacktick
    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const s = buf.trim()
      if (s.length > 0) stmts.push(s)
      buf = ''
    } else {
      buf += ch
    }
    prev = ch
  }
  if (buf.trim()) stmts.push(buf.trim())
  return stmts
}

const normalizeIdentifier = (raw) => {
  if (!raw) return null
  // remove ${...} wrappers and quotes/backticks
  let s = String(raw)
  s = s.replace(/\$\{|\}/g, '')
  s = s.replace(/[`"']/g, '')
  return s.trim()
}

const extractTargetTable = (stmt, type) => {
  // type: 'create'|'insert'|'delete'|'truncate'
  const s = stmt.replace(/\s+/g, ' ')
  let m
  if (type === 'create') {
    m = s.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.`"\$\{\}-]+(?:\.[\w.`"\$\{\}-]+)?)/i)
  } else if (type === 'insert') {
    m = s.match(/insert\s+into\s+([^\s(]+)/i)
  } else if (type === 'delete') {
    m = s.match(/delete\s+from\s+([^\s;]+)/i)
  } else if (type === 'truncate') {
    m = s.match(/truncate\s+table\s+([^\s;]+)/i)
  }
  if (m && m[1]) return normalizeIdentifier(m[1])
  return null
}

const extractTablesFromSelect = (stmt) => {
  const tables = new Set()
  // crude capture after FROM and JOIN
  const regex = /(?:from|join)\s+([\w.`\"]+(?:\.[\w.`\"]+)?)/ig
  let m
  while ((m = regex.exec(stmt)) !== null) {
    if (m[1]) tables.add(normalizeIdentifier(m[1]))
  }
  return Array.from(tables)
}

const splitSchemaTable = (ident) => {
  if (!ident) return { schema: '', table: '' }
  const parts = ident.split('.')
  if (parts.length === 1) return { schema: '', table: parts[0].toLowerCase() }
  return { schema: parts[0].toLowerCase(), table: parts[1].toLowerCase() }
}

const SqlProcessor = () => {
  const [fileName, setFileName] = useState('')
  const [origSql, setOrigSql] = useState('')
  const [processedSql, setProcessedSql] = useState('')
  const [messages, setMessages] = useState([])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target.result)
      setOrigSql(text)
      setMessages(['文件加载完毕，准备处理...'])
    }
    reader.readAsText(f, 'utf-8')
    // clear the input value so selecting the same file again will trigger change
    try { e.target.value = '' } catch (e2) {}
  }

  const processSql = () => {
    if (!origSql) {
      setMessages(['请先上传 .sql 文件。'])
      return
    }
    // If file contains a marker line with '写入dt表', remove that line and everything after it
    let sqlToProcess = origSql
    const mIndex = sqlToProcess.search(/写入dt表/i)
    if (mIndex !== -1) {
      // find start of the line containing the marker
      const before = sqlToProcess.substring(0, mIndex)
      const lastNewline = before.lastIndexOf('\n')
      sqlToProcess = lastNewline === -1 ? '' : sqlToProcess.substring(0, lastNewline)
      setMessages(prev => [...prev, '检测到 "写入dt表" 标记，已删除该行及其之后所有内容。'])
    }
    const stmts = parseStatements(sqlToProcess)
    // classification map: key = schema.table or table (lowercase), value = { hasCreate, hasDML, inSelect, isHistory, originalSchemas:Set }
    const tblMap = new Map()

    const markTable = (ident, flags = {}) => {
      if (!ident) return
      const norm = ident.toLowerCase()
      if (!tblMap.has(norm)) {
        tblMap.set(norm, { name: norm, hasCreate: false, hasDML: false, inSelect: false, isHistory: norm.endsWith('_dt'), schemas: new Set() })
      }
      const rec = tblMap.get(norm)
      if (flags.create) rec.hasCreate = true
      if (flags.dml) rec.hasDML = true
      if (flags.select) rec.inSelect = true
      if (flags.schema) rec.schemas.add(flags.schema)
    }

    // first pass: scan statements
    stmts.forEach((s) => {
      const trimmed = s.trim()
      if (!trimmed) return
      if (trimmed.startsWith('@')) return // will be removed
      const low = trimmed.toLowerCase()
      // detect create
      if (/^create\s+table/i.test(trimmed)) {
        const ident = extractTargetTable(trimmed, 'create')
        const parts = splitSchemaTable(ident)
        markTable(parts.table, { create: true, schema: parts.schema || '' })
      }
      // insert
      if (/^insert\s+into/i.test(trimmed)) {
        const ident = extractTargetTable(trimmed, 'insert')
        const parts = splitSchemaTable(ident)
        markTable(parts.table, { dml: true, schema: parts.schema || '' })
      }
      // delete
      if (/^delete\s+from/i.test(trimmed)) {
        const ident = extractTargetTable(trimmed, 'delete')
        const parts = splitSchemaTable(ident)
        markTable(parts.table, { dml: true, schema: parts.schema || '' })
      }
      // truncate
      if (/^truncate\s+table/i.test(trimmed)) {
        const ident = extractTargetTable(trimmed, 'truncate')
        const parts = splitSchemaTable(ident)
        markTable(parts.table, { dml: true, schema: parts.schema || '' })
      }
      // select/join
      if (/\bselect\b/i.test(low) || /\bjoin\b/i.test(low)) {
        const tbls = extractTablesFromSelect(trimmed)
        tbls.forEach(t => {
          const parts = splitSchemaTable(t)
          markTable(parts.table, { select: true, schema: parts.schema || '' })
        })
      }
    })

    // classify
    const classMap = { type1: [], type2: [], readonly: [], history: [] }
    for (const [k, v] of tblMap.entries()) {
      if (v.isHistory) {
        classMap.history.push(k)
      } else if (v.hasDML && !v.hasCreate) {
        classMap.type1.push(k)
      } else if (v.hasDML && v.hasCreate) {
        classMap.type2.push(k)
      } else if (v.inSelect && !v.hasDML && !v.hasCreate) {
        classMap.readonly.push(k)
      }
    }

    setMessages([`检测到 一类(${classMap.type1.length}) 二类(${classMap.type2.length}) 只读(${classMap.readonly.length}) 历史(${classMap.history.length})`])

    // process statements
    const out = []
    // track whether create-for-ptemp already added for a type1 or type2 (we add only for type1 before first DML per table)
    const createdPtemp = new Set()

    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i]
      const t = s.trim()
      if (!t) continue
      if (t.startsWith('@')) {
        // skip
        continue
      }
      const low = t.toLowerCase()
      // if history table DML -> remove
      let handled = false

      // INSERT
      if (/^insert\s+into/i.test(t)) {
        const ident = extractTargetTable(t, 'insert')
        const parts = splitSchemaTable(ident)
        const key = parts.table
        if (classMap.history.includes(key)) {
          // skip this statement (delete history DML)
          handled = true
        } else if (classMap.type1.includes(key) || classMap.type2.includes(key)) {
          // if type1 and not created ptemp yet, insert create/drop before this statement
          if (classMap.type1.includes(key) && !createdPtemp.has(key)) {
            // determine original schema
            const originalSchema = parts.schema || (tblMap.get(key) && Array.from(tblMap.get(key).schemas)[0]) || ''
            const likeRef = originalSchema ? `${originalSchema}.${key}` : key
            out.push(`drop table if exists ptemp.${key}`)
            out.push(`create table ptemp.${key} like ${likeRef}`)
            createdPtemp.add(key)
          }
          // replace target table occurrence after insert into with ptemp.table
              let newStmt = t.replace(/(insert\s+into\s+)([^\s(]+)/i, `$1ptemp.${key}`)
              // also replace FROM/JOIN inside this statement
              const regexRefInner = /(\b(?:from|join)\b\s*)([^\s,()]+)/ig
              newStmt = newStmt.replace(regexRefInner, (full, prefix, ident) => {
                const norm2 = normalizeIdentifier(ident)
                const parts2 = splitSchemaTable(norm2)
                const tbl2 = parts2.table
                if (classMap.history.includes(tbl2) || classMap.readonly.includes(tbl2)) return full
                if (classMap.type1.includes(tbl2) || classMap.type2.includes(tbl2)) return `${prefix}ptemp.${tbl2}`
                return full
              })
              out.push(newStmt)
          handled = true
        }
      }

      // DELETE
      if (!handled && /^delete\s+from/i.test(t)) {
        const ident = extractTargetTable(t, 'delete')
        const parts = splitSchemaTable(ident)
        const key = parts.table
        if (classMap.history.includes(key)) {
          handled = true // remove
        } else if (classMap.type1.includes(key) || classMap.type2.includes(key)) {
          if (classMap.type1.includes(key) && !createdPtemp.has(key)) {
            const originalSchema = parts.schema || (tblMap.get(key) && Array.from(tblMap.get(key).schemas)[0]) || ''
            const likeRef = originalSchema ? `${originalSchema}.${key}` : key
            out.push(`drop table if exists ptemp.${key}`)
            out.push(`create table ptemp.${key} like ${likeRef}`)
            createdPtemp.add(key)
          }
          let newStmt = t.replace(/(delete\s+from\s+)([^\s;]+)/i, `$1ptemp.${key}`)
          // replace FROM/JOIN in any subqueries inside delete (best-effort)
          const regexRefInnerDel = /(\b(?:from|join)\b\s*)([^\s,()]+)/ig
          newStmt = newStmt.replace(regexRefInnerDel, (full, prefix, ident) => {
            const norm2 = normalizeIdentifier(ident)
            const parts2 = splitSchemaTable(norm2)
            const tbl2 = parts2.table
            if (classMap.history.includes(tbl2) || classMap.readonly.includes(tbl2)) return full
            if (classMap.type1.includes(tbl2) || classMap.type2.includes(tbl2)) return `${prefix}ptemp.${tbl2}`
            return full
          })
          out.push(newStmt)
          handled = true
        }
      }

      // TRUNCATE
      if (!handled && /^truncate\s+table/i.test(t)) {
        const ident = extractTargetTable(t, 'truncate')
        const parts = splitSchemaTable(ident)
        const key = parts.table
        if (classMap.history.includes(key)) {
          handled = true
        } else if (classMap.type1.includes(key) || classMap.type2.includes(key)) {
          if (classMap.type1.includes(key) && !createdPtemp.has(key)) {
            const originalSchema = parts.schema || (tblMap.get(key) && Array.from(tblMap.get(key).schemas)[0]) || ''
            const likeRef = originalSchema ? `${originalSchema}.${key}` : key
            out.push(`drop table if exists ptemp.${key}`)
            out.push(`create table ptemp.${key} like ${likeRef}`)
            createdPtemp.add(key)
          }
          let newStmt = t.replace(/(truncate\s+table\s+)([^\s;]+)/i, `$1ptemp.${key}`)
          out.push(newStmt)
          handled = true
        }
      }

      if (!handled) {
        // For SELECT/JOIN/FROM clauses, replace references to type1/type2 tables with ptemp.table
        let newStmt = t
        if (/\bfrom\b|\bjoin\b/i.test(t)) {
          // match from/join followed by identifier possibly wrapped with ${}, quotes or backticks,
          // and allow optional newline between keyword and identifier
          const regexRef = /(\b(?:from|join)\b\s*)([\s\S]*?)(?=(\s+as\s+|\s+\w+\s|\s*,|\s+where\b|\s+join\b|\s+on\b|\s*\(|$))/ig
          newStmt = t.replace(regexRef, (full, prefix, ident) => {
            const trimmedIdent = ident.trim()
            const norm = normalizeIdentifier(trimmedIdent)
            const parts = splitSchemaTable(norm)
            const tbl = parts.table
            // do not modify history or readonly tables
            if (classMap.history.includes(tbl) || classMap.readonly.includes(tbl)) return full
            if (classMap.type1.includes(tbl) || classMap.type2.includes(tbl)) {
              // preserve spacing after prefix and any alias will remain after the matched group
              return `${prefix}ptemp.${tbl}`
            }
            return full
          })
        }
        out.push(newStmt)
      }
    }

    // Also modify CREATE statements: if create targets a modification table, change schema to ptemp
    const finalOut = out.map(stmt => {
      const s = stmt
      const sTrim = s.trim()
      const createMatch = sTrim.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?/i)
      if (createMatch) {
        const rawIdent = extractTargetTable(sTrim, 'create')
        const parts = splitSchemaTable(rawIdent)
        const key = parts.table
        if (classMap.type1.includes(key) || classMap.type2.includes(key)) {
          // find position of '(' to replace the identifier between create ... and (
          const idx = s.search(/\(/)
          if (idx !== -1) {
            // find prefix end index where table identifier starts
            const prefixMatch = s.match(/(create\s+table\s+(?:if\s+not\s+exists\s+)?)/i)
            const prefixLen = prefixMatch ? prefixMatch[0].length : 0
            const before = s.substring(0, prefixLen)
            const after = s.substring(idx)
            return `${before}ptemp.${key}${after}`
          }
        }
      }
      return s
    })

    const resultSql = finalOut.join(';\n') + (finalOut.length ? ';' : '')
    setProcessedSql(resultSql)
    setMessages(prev => [...prev, '处理完成，可下载结果。'])
  }

  const downloadResult = () => {
    if (!processedSql) return
    const blob = new Blob([processedSql], { type: 'text/sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName ? `${fileName.replace(/\.sql$/i, '')}_processed.sql` : 'processed.sql'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container sql-processor">
      <h1>PTEMP 转化</h1>
      <div className="input-section">
        <label>选择要处理的 SQL 文件：</label>
        <input type="file" accept=".sql" onChange={handleFile} />
        {fileName && <div className="small">已选: {fileName}</div>}
        <div className="controls">
          <button onClick={processSql} className="process-btn">开始处理</button>
          <button onClick={downloadResult} className="download-btn" disabled={!processedSql}>下载结果</button>
        </div>
        <div className="msg-list">
          {messages.map((m, i) => <div key={i} className="msg">{m}</div>)}
        </div>
      </div>

      <div className="preview">
        <h3>处理后预览</h3>
        <pre className="preview-box">{processedSql || '处理结果将在此显示'}</pre>
      </div>
    </div>
  )
}

export default SqlProcessor
