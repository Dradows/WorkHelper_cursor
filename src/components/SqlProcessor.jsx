import React, { useState } from 'react'
import JSZip from 'jszip'
import './SqlProcessor.css'


const SqlProcessor = () => {
  const [fileName, setFileName] = useState('')
  const [origSql, setOrigSql] = useState('')
  const [processedSql, setProcessedSql] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([]) // {name, content}
  const [processedFiles, setProcessedFiles] = useState([]) // {name, content}
  const [messages, setMessages] = useState([])
  const [addInitStatements, setAddInitStatements] = useState(true)

  const handleFile = (e) => {
    const fileList = Array.from(e.target.files || [])
    if (!fileList.length) return
    setFileName(fileList.length === 1 ? fileList[0].name : `${fileList.length} files`)
    setProcessedSql('')
    setProcessedFiles([])
    setMessages(['文件加载中...'])

    // read all files
    const reads = fileList.map(f => new Promise((res) => {
      const rd = new FileReader()
      rd.onload = (ev) => res({ name: f.name, content: String(ev.target.result) })
      rd.readAsText(f, 'utf-8')
    }))

    Promise.all(reads).then(arr => {
      setSelectedFiles(arr)
      // for convenience, set origSql to first file content
      if (arr[0]) setOrigSql(arr[0].content)
      setMessages([`已加载 ${arr.length} 个文件，准备处理...`])
    })
    try { e.target.value = '' } catch (err) {}
  }

  // processText: core reusable processor for a single SQL string
  const processText = (raw, options = { addInitStatements: true }) => {
    const addInit = !!options.addInitStatements
    if (!raw) return { result: '', summary: { type1: 0, type2: 0, readonly: 0, history: 0 } }

    // remove lines that start with @ (entire line)
    const cleaned = raw.split(/\r?\n/).filter(l => !/^\s*@/.test(l)).join('\n')

    // split into semicolon-terminated statements while preserving internal newlines
    const stmtRegex = /([\s\S]*?;)/g
    const stmts = []
    let match
    let lastIndex = 0
    while ((match = stmtRegex.exec(cleaned)) !== null) {
      stmts.push(match[1])
      lastIndex = stmtRegex.lastIndex
    }
    if (lastIndex < cleaned.length) {
      stmts.push(cleaned.slice(lastIndex))
    }

    // collect table info keyed by last segment
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
      if (trunc) markTable(trunc, 'mod')
        const drop = extractMainTable(s, 'drop')
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
      // Replace occurrences for all type1/type2 tables globally so FROM/JOIN references are also rewritten
      for (const lastKey of [...type1, ...type2]) {
        if (!lastKey) continue
        if (historySet.has(lastKey)) continue
        const repl = `ptemp.${lastKey}`
        const info = tableMap[lastKey]
        if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
        cur = replaceTableOccurrence(cur, lastKey, repl)
      }
      const mainInsert = extractMainTable(s, 'insert')
      const mainDelete = extractMainTable(s, 'delete')
      const mainTrunc = extractMainTable(s, 'truncate')
      const mainCreate = extractMainTable(s, 'create')
        const mainDrop = extractMainTable(s, 'drop')

      const dmlTarget = mainInsert || mainDelete || mainTrunc || mainDrop
      if (dmlTarget) {
        const lastKey = mkLastSegment(dmlTarget)
        // skip history DML only if it's not a DROP (we still want to rewrite DROP schema)
        if (!mainDrop && historySet.has(lastKey)) continue
        let repl = null
        if (!lastKey) repl = null
        else if (type1.has(lastKey) || type2.has(lastKey)) {
          const ptempName = `ptemp.${lastKey}`
          if (addInit && type1.has(lastKey) && !inited.has(lastKey)) {
            const dropLine = `\n\ndrop table if exists ${ptempName};\n`
            const repFull = tableMap[lastKey] && tableMap[lastKey].repFull ? tableMap[lastKey].repFull : lastKey
            const createLike = `create table ${ptempName} like ${repFull};\n`
            output.push(dropLine + createLike)
            inited.add(lastKey)
          }
          repl = ptempName
        }

        if (repl === 'SKIP_HISTORY') continue
        if (repl) {
          const info = tableMap[lastKey]
          if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
          cur = replaceTableOccurrence(cur, lastKey, repl)
        }
      }

      if (mainCreate && type2.has(mkLastSegment(mainCreate))) {
        const lastKey = mkLastSegment(mainCreate)
        const repl = `ptemp.${lastKey}`
        const info = tableMap[lastKey]
        if (info && info.fullNames) for (const ff of info.fullNames) cur = replaceTableOccurrence(cur, ff, repl)
        cur = replaceTableOccurrence(cur, lastKey, repl)
      }

      output.push(cur)
    }

    return { result: output.join(''), summary: { type1: type1.size, type2: type2.size, readonly: readonly.size, history: historySet.size } }
  }

  // helpers to parse and transform SQL according to requirements
  const normalize = (raw) => {
    if (!raw) return ''
    // strip wrapping quotes/backticks and trailing punctuation
    return raw.replace(/^\s*[`'"]?/, '').replace(/[`'",;\)]*\s*$/, '')
  }

  const extractMainTable = (stmt, kind) => {
    // kind: 'create'|'insert'|'delete'|'truncate'|'select'
    let re
    switch (kind) {
      case 'create':
        re = /create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(,;]+)/i
        break
      case 'insert':
        re = /insert\s+(?:into\s+)?([^\s(,;]+)/i
        break
      case 'delete':
        re = /delete\s+from\s+([^\s(,;]+)/i
        break
      case 'truncate':
        re = /truncate\s+table\s+([^\s(,;]+)/i
        break
      case 'drop':
        re = /drop\s+table\s+(?:if\s+exists\s+)?([^\s(,;]+)/i
        break
      case 'select':
        // select/join may contain many tables; caller handles list
        return []
      default:
        return null
    }

    const m = stmt.match(re)
    if (!m) return null
    return normalize(m[1])
  }

  const extractFromAndJoins = (stmt) => {
    const res = []
    const re = /(?:from|join)\s+([^\s,;()]+)/gi
    let m
    while ((m = re.exec(stmt)) !== null) {
      res.push(normalize(m[1]))
    }
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
    // If originalFull is an unqualified table name (no dot), do NOT replace when it's already prefixed with ptemp.
      if (originalFull.indexOf('.') === -1) {
        // unqualified names: skip replacements for already prefixed ptemp names
        const re = new RegExp(`(?<!ptemp\.)\b${escaped}\b`, 'gi')
        return stmt.replace(re, toReplace)
      }
      // qualified names: ensure we match the full token and not substrings (avoid replacing
      // 'risk_test_final' inside 'risk_test_final_fk'). Use lookaround boundaries so the match
      // is not part of a larger identifier.
      const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'gi')
      return stmt.replace(re, toReplace)
  }


  const processSql = () => {
    // process single-or-first file
    if (selectedFiles.length > 1) {
      processAll()
      return
    }
    if (!origSql) {
      setMessages(['请先加载一个 SQL 文件。'])
      return
    }
    setMessages(['正在处理 SQL...'])
    const { result, summary } = processText(origSql, { addInitStatements })
    setProcessedSql(result)
    setProcessedFiles([{ name: fileName || 'processed.sql', content: result }])
    setMessages([`处理完成：共发现 ${summary.type1} 个一类修改表，${summary.type2} 个二类修改表，${summary.readonly} 个只读表，${summary.history} 个历史表。`])
  }

  // process all selected files
  const processAll = async () => {
    if (!selectedFiles.length) { setMessages(['请先选择文件']); return }
    setMessages([`正在批量处理 ${selectedFiles.length} 个文件...`])
    const results = []
    let total = { type1: 0, type2: 0, readonly: 0, history: 0 }
    for (const f of selectedFiles) {
      const { result, summary } = processText(f.content, { addInitStatements })
      results.push({ name: f.name, content: result })
      total.type1 += summary.type1
      total.type2 += summary.type2
      total.readonly += summary.readonly
      total.history += summary.history
    }
    setProcessedFiles(results)
    setProcessedSql(results.length ? results[0].content : '')
    setMessages([`批量处理完成：${results.length} 个文件 — 一类修改表 ${total.type1}，二类 ${total.type2}，只读 ${total.readonly}，历史 ${total.history}`])
  }

  const downloadResult = async () => {
    if (!processedFiles.length && !processedSql) return

    // if multiple processed files => zip
    if (processedFiles.length > 1) {
      const zip = new JSZip()
      processedFiles.forEach(f => {
        const base = f.name.replace(/\.sql$/i, '')
        zip.file(`${base}_ptemp.sql`, f.content)
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName && fileName !== '' ? fileName.replace(/\s+/g, '_') : 'processed'}_ptemp.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      return
    }

    // single file fall-back
    const content = processedFiles.length === 1 ? processedFiles[0].content : processedSql
    const orig = processedFiles.length === 1 ? processedFiles[0].name : fileName
    const base = orig ? orig.replace(/\.sql$/i, '') : 'processed'
    const blob = new Blob([content], { type: 'text/sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}_ptemp.sql`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container sql-processor">
      <h1>SQL 处理器（PTEMP 转换）</h1>
      <div className="input-section">
        <label>选择要处理的 SQL 文件（可多选）：</label>
        <input type="file" accept=".sql" multiple onChange={handleFile} />
        {fileName && <div className="small">已选: {fileName}</div>}
        {selectedFiles.length > 1 && <div className="small">已加载文件: {selectedFiles.map(f => f.name).join(', ')}</div>}
        <div className="controls">
          <label className="checkbox-inline">
            <input type="checkbox" checked={addInitStatements} onChange={(e) => setAddInitStatements(e.target.checked)} />
            <span>新增 drop/create 语句</span>
          </label>
          <button onClick={processSql} className="process-btn">开始处理</button>
          <button onClick={downloadResult} className="download-btn" disabled={!processedSql}>下载结果</button>
        </div>
        <div className="msg-list">
          {messages.map((m, i) => <div key={i} className="msg">{m}</div>)}
        </div>
      </div>

      <div className="preview">
        <h3>处理后预览</h3>
        <pre className="preview-box">{processedSql || (processedFiles.length ? processedFiles.map(f => `-- ${f.name}\n${f.content}`).join('\n\n') : '处理结果将在此显示（会保留空行）')}</pre>
      </div>
    </div>
  )
}

export default SqlProcessor
