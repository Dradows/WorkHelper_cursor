import { useState } from 'react'
import './ExcelImporter.css'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
// templates no longer used for DDL generation; DDLs will be built from Excel content

const ExcelImporter = () => {
  const [fileName, setFileName] = useState('')
  // store sheet infos parsed from the uploaded workbook: { sheet, tableName }
  const [sheetInfos, setSheetInfos] = useState([])
  const [name, setName] = useState('')
  // default date to today in YYYY-MM-DD for the date input
  const defaultDate = new Date().toISOString().slice(0, 10)
  const [createDate, setCreateDate] = useState(defaultDate) // YYYY-MM-DD
  const [orderNo, setOrderNo] = useState('')
  const [messages, setMessages] = useState([])

  const parseFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      // try to get header-based JSON first
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
      const names = workbook.SheetNames || []
      // build sheetInfos by reading specific cells per sheet:
      // B1 = table name, B3 = schema, B4 = table comment. Fields start from row 7 (index 6):
      // B = field name, C = field type, D = field comment. Continue until first empty B cell.
      const infos = names.map((s) => {
        const w = workbook.Sheets[s]
        const rows = XLSX.utils.sheet_to_json(w, { header: 1, defval: '' })
        const firstRow = rows[0] || []
        const tableRaw = firstRow[1]
        const tableName = tableRaw ? String(tableRaw).trim().replace(/[^A-Za-z0-9_]/g, '_') : null
        const b3 = (rows[2] && rows[2][1]) ? String(rows[2][1]).trim() : '' // B3 schema
        const b4 = (rows[3] && rows[3][1]) ? String(rows[3][1]).trim() : '' // B4 table comment
        const columns = []
        for (let i = 6; i < rows.length; i++) {
          const r = rows[i]
          if (!r) continue
          const fname = r[1] ? String(r[1]).trim() : ''
          if (!fname) break
          const ftype = r[2] ? String(r[2]).trim() : ''
          const fcomment = r[3] ? String(r[3]).trim() : ''
          columns.push({ name: fname, type: ftype, comment: fcomment })
        }
        return { sheet: s, tableName, schema: b3, tableComment: b4, columns }
      })
      setSheetInfos(infos)
      setMessages(prev => [...prev, `解析到 ${json.length} 行（不含表头），共 ${infos.length} 个 sheet`])
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    parseFile(f)
  }

  const formatDateForHeader = (input) => {
    if (!input) return ''
    // input is expected as YYYY-MM-DD (date input). Convert to YYYYMMDD
    try {
      // simple replace of '-' for predictable result
      return input.replace(/-/g, '')
    } catch (e) {
      return ''
    }
  }

  // templates are no longer used; DDLs built directly from Excel

  const inferColumnType = (colName) => {
    const n = String(colName).toLowerCase()
    if (/id$|^id$/.test(n)) return 'INTEGER'
    if (/(score|amount|money|amt)/.test(n)) return 'DECIMAL(21,2)'
    if (/(ts|time|date|dt|timestamp)/.test(n)) return 'TIMESTAMP(0) WITHOUT TIME ZONE'
    return 'VARCHAR(300)'
  }

  const buildDDLForTable = (template, schemaName, newTableName, colNames) => {
    // Build DDL from scratch (ignore previous template structure)
    // newTableName: target table name string
    // colNames: array of {name,type,comment}
    // build column definitions
    // Build column lines where commas are at the start of the next line
    const schema = schemaName && schemaName.length > 0 ? schemaName : 'chn_rskdata'
    let colsArr = []
    if (colNames && colNames.length > 0) {
      colNames.forEach((c, idx) => {
        const t = c.type && c.type.length > 0 ? c.type : inferColumnType(c.name)
        if (idx === 0) {
          colsArr.push(`     ${c.name} ${t}`)
        } else {
          // comma at the beginning of the line, no space between comma and field name
          colsArr.push(`    ,${c.name} ${t}`)
        }
      })
    } else {
      colsArr = [ '     id INTEGER', '    ,name VARCHAR(300)' ]
    }

    const createBlock = `CREATE TABLE ${schema}.${newTableName} (\n${colsArr.join('\n')}\n)\nWITH (ORIENTATION = COLUMN, COMPRESSION = MIDDLE) \nDISTRIBUTE BY ROUNDROBIN;\n\n`
    return createBlock
  }

  const buildDDLFromInfo = (info) => {
    const rawTable = info.tableName || info.sheet
    const table = String(rawTable).toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const progName = `RSK_CHN_${String(table).toUpperCase()}`
    const chineseName = info.tableComment || ''
    const creator = name || '姓名'
    const formatted = formatDateForHeader(createDate) || formatDateForHeader(new Date().toISOString())
    const header = `--#####################################################################################################\n` +
      `--# 程序名: ${progName}\n` +
      `--# 程序中文名: ${chineseName}\n` +
      `--# 创建者: ${creator}\n` +
      `--# 创建日期: ${formatted}\n` +
      `--# 修改历史: 修改时间*****修改者*****修改CQ**********修改内容\n` +
      `--# 说明: ${formatted}*****${creator}*****${orderNo}*****创建脚本\n` +
      `--#####################################################################################################\n\n`

    const rawSchema = info.schema || ''
    const schema = rawSchema ? String(rawSchema).toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'chn_rskdata'
    const createBlock = buildDDLForTable('', schema, table, info.columns)

    // comments
    let comments = `COMMENT ON TABLE ${schema}.${table} IS '${chineseName}';\n`
    info.columns.forEach((c) => {
      const colComment = c.comment || ''
      comments += `COMMENT ON COLUMN ${schema}.${table}.${c.name} IS '${colComment}';\n`
    })

    // For ddl.sql we DO NOT include a DROP TABLE. The init.sql will add the DROP for the _dt table later.
    return header + createBlock + `\n` + comments
  }

  // NOTE: Insert generation removed per request — DDL templates will be generated without data inserts.

  const downloadFile = (content, filename) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleGenerate = () => {
    if (!name || !createDate || !orderNo) {
      setMessages(prev => [...prev, '请填写 姓名、创建日期 和 单号。'])
      return
    }
    // Create a zip containing DDL and init files per sheet, then download it
    const zip = new JSZip()

    // generate DDL and init files for each sheet based on Excel content
      if (sheetInfos && sheetInfos.length > 0) {
        sheetInfos.forEach((info) => {
          const sheet = info.sheet
          const rawTable = info.tableName || String(sheet)
          const table = String(rawTable).toLowerCase().replace(/[^a-z0-9_]/g, '_')
          const ddlContent = buildDDLFromInfo(info)
          const rawSchema = info.schema || ''
          const schema = rawSchema ? String(rawSchema).toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'chn_rskdata'
          // For init file, before creating the _dt table, add DROP IF EXISTS for the _dt
          const initContent = ddlContent + `\nDROP TABLE IF EXISTS ${schema}.${table}_dt;\nCREATE TABLE ${schema}.${table}_dt like ${schema}.${table};\n`
          const ddlName = `rsk_chn_${table}_ddl.sql`
          const initName = `rsk_chn_${table}_init.sql`
          zip.file(ddlName, ddlContent)
          zip.file(initName, initContent)
          setMessages(prev => [...prev, `为 sheet "${sheet}" 生成 ${ddlName} 和 ${initName}`])
        })
      }

    const zipFileName = (() => {
      const on = orderNo ? String(orderNo).trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'no_order'
      const nm = name ? String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'no_name'
      const d = createDate ? formatDateForHeader(createDate) : formatDateForHeader(new Date().toISOString())
      return `${on}_${nm}_${d}.zip`
    })()

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      downloadFile(blob, zipFileName)
      setMessages(prev => [...prev, `已生成并开始下载 ${zipFileName}。`])
    }).catch((err) => {
      setMessages(prev => [...prev, `打包失败: ${err.message || err}`])
    })
  }

  return (
    <div className="container">
      <h1>DDL生成</h1>

      <div className="input-section">
        <label>Excel 文件（第一张表）</label>
        <input type="file" accept=".xls,.xlsx" onChange={handleFile} />
        {fileName && <div className="small">已选: {fileName}</div>}
      </div>

      <div className="input-section">
        <label>创建者（姓名）</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="请输入姓名" />
      </div>

      <div className="input-section">
        <label>创建日期</label>
        <input type="date" value={createDate} onChange={e => setCreateDate(e.target.value)} />
      </div>

      <div className="input-section">
        <label>单号</label>
        <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="请输入单号" />
      </div>

      <div className="qr-controls">
        <button className="download-btn" onClick={handleGenerate}>生成并下载 SQL 文件</button>
        <div style={{ minWidth: 12 }} />
        <div className="msg-list">
          {messages.map((m, i) => (
            <div key={i} className="msg">{m}</div>
          ))}
        </div>
      </div>

      <div className="notes" style={{ padding: '20px' }}>
        <p>说明：</p>
        <ul>
          <li>基于 Excel 中每个 sheet 的定义（B1 表名，B3 schema，B4 表注释，B7 起为字段：B=字段名 C=字段类型 D=字段注释）生成 DDL 与 INIT 文件。</li>
        </ul>
      </div>
    </div>
  )
}

export default ExcelImporter
