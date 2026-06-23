const sql = require('mssql');

async function run() {
  try {
    await sql.connect('mssql://sa:password@localhost/HOLA1?encrypt=true&trustServerCertificate=true');
    const result = await sql.query(`
      SELECT 
        t.TABLE_SCHEMA AS [schema],
        t.TABLE_NAME AS name,
        t.TABLE_TYPE AS type,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c 
         WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME) AS columnCount,
        p.rows AS [rowCount]
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME 
        AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
      LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0, 1)
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `);
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
