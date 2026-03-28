import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TemplateEngine } from './template-engine'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

describe('TemplateEngine - Data Source Parsing', () => {
  let templateEngine: TemplateEngine
  const testDataDir = './test-data-temp'

  beforeAll(() => {
    templateEngine = new TemplateEngine()
    
    // 创建测试数据目录
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true })
    }
  })

  afterAll(() => {
    // 清理测试数据目录
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('Excel Data Source', () => {
    it('should parse valid Excel file with multiple records', async () => {
      // 创建测试 Excel 文件
      const testData = [
        { name: 'John Doe', company: 'Acme Corp', email: 'john@acme.com', age: 30 },
        { name: 'Jane Smith', company: 'Tech Inc', email: 'jane@tech.com', age: 25 },
        { name: 'Bob Johnson', company: 'StartUp LLC', email: 'bob@startup.com', age: 35 }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-data.xlsx')
      XLSX.writeFile(workbook, excelPath)

      // 解析 Excel 文件
      const records = await templateEngine.parseDataSource(excelPath)

      // 验证结果
      expect(records).toHaveLength(3)
      expect(records[0]).toEqual(testData[0])
      expect(records[1]).toEqual(testData[1])
      expect(records[2]).toEqual(testData[2])
    })

    it('should parse Excel file with Chinese characters', async () => {
      const testData = [
        { 姓名: '张三', 公司: '阿里巴巴', 邮箱: 'zhangsan@alibaba.com' },
        { 姓名: '李四', 公司: '腾讯', 邮箱: 'lisi@tencent.com' }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-chinese.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(2)
      expect(records[0].姓名).toBe('张三')
      expect(records[1].姓名).toBe('李四')
    })

    it('should parse Excel file with mixed data types', async () => {
      const testData = [
        { name: 'Product A', price: 99.99, inStock: true, quantity: 100 },
        { name: 'Product B', price: 149.50, inStock: false, quantity: 0 }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-mixed-types.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(2)
      expect(records[0].name).toBe('Product A')
      expect(records[0].price).toBe(99.99)
      expect(records[0].inStock).toBe(true)
      expect(records[0].quantity).toBe(100)
    })

    it('should handle Excel file with empty cells', async () => {
      const testData = [
        { name: 'John', company: 'Acme', email: 'john@acme.com' },
        { name: 'Jane', company: '', email: 'jane@example.com' }, // 空公司名
        { name: 'Bob', company: 'Tech', email: '' } // 空邮箱
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-empty-cells.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(3)
      expect(records[1].company).toBe('')
      expect(records[2].email).toBe('')
    })

    it('should parse .xls format (old Excel format)', async () => {
      const testData = [
        { name: 'Test User', value: 123 }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const xlsPath = path.join(testDataDir, 'test-data.xls')
      XLSX.writeFile(workbook, xlsPath, { bookType: 'xls' })

      const records = await templateEngine.parseDataSource(xlsPath)

      expect(records).toHaveLength(1)
      expect(records[0].name).toBe('Test User')
    })

    it('should throw error for Excel file with no sheets', async () => {
      // 创建一个空的 Excel 文件（没有工作表）
      // Note: xlsx library doesn't allow creating completely empty workbooks
      // So we'll create a workbook with an empty sheet and then test parsing
      const worksheet = XLSX.utils.aoa_to_sheet([])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      const excelPath = path.join(testDataDir, 'empty-workbook.xlsx')
      XLSX.writeFile(workbook, excelPath)

      // This should throw because the sheet has no data
      await expect(
        templateEngine.parseDataSource(excelPath)
      ).rejects.toThrow('Excel file contains no data')
    })

    it('should throw error for Excel file with no data', async () => {
      // 创建一个只有表头没有数据的 Excel 文件
      const worksheet = XLSX.utils.aoa_to_sheet([['name', 'email']])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'no-data.xlsx')
      XLSX.writeFile(workbook, excelPath)

      await expect(
        templateEngine.parseDataSource(excelPath)
      ).rejects.toThrow('Excel file contains no data')
    })

    it('should parse Excel file with single record', async () => {
      const testData = [
        { name: 'Single User', email: 'single@example.com' }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'single-record.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(1)
      expect(records[0].name).toBe('Single User')
    })
  })

  describe('CSV Data Source', () => {
    it('should parse valid CSV file with multiple records', async () => {
      const csvContent = `name,company,email,age
John Doe,Acme Corp,john@acme.com,30
Jane Smith,Tech Inc,jane@tech.com,25
Bob Johnson,StartUp LLC,bob@startup.com,35`

      const csvPath = path.join(testDataDir, 'test-data.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(3)
      expect(records[0].name).toBe('John Doe')
      expect(records[0].company).toBe('Acme Corp')
      expect(records[0].email).toBe('john@acme.com')
      expect(records[0].age).toBe('30') // CSV 解析器返回字符串
    })

    it('should parse CSV file with Chinese characters', async () => {
      const csvContent = `姓名,公司,邮箱
张三,阿里巴巴,zhangsan@alibaba.com
李四,腾讯,lisi@tencent.com`

      const csvPath = path.join(testDataDir, 'test-chinese.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(2)
      expect(records[0].姓名).toBe('张三')
      expect(records[1].姓名).toBe('李四')
    })

    it('should handle CSV file with quoted fields', async () => {
      const csvContent = `name,description,price
"Product A","A great product, with comma",99.99
"Product B","Another ""quoted"" product",149.50`

      const csvPath = path.join(testDataDir, 'test-quoted.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(2)
      expect(records[0].description).toBe('A great product, with comma')
      expect(records[1].description).toBe('Another "quoted" product')
    })

    it('should handle CSV file with empty fields', async () => {
      const csvContent = `name,company,email
John,Acme,john@acme.com
Jane,,jane@example.com
Bob,Tech,`

      const csvPath = path.join(testDataDir, 'test-empty-fields.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(3)
      expect(records[1].company).toBe('')
      expect(records[2].email).toBe('')
    })

    it('should parse CSV file with single record', async () => {
      const csvContent = `name,email
Single User,single@example.com`

      const csvPath = path.join(testDataDir, 'single-record.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(1)
      expect(records[0].name).toBe('Single User')
    })

    it('should throw error for empty CSV file', async () => {
      const csvPath = path.join(testDataDir, 'empty.csv')
      fs.writeFileSync(csvPath, '', 'utf-8')

      await expect(
        templateEngine.parseDataSource(csvPath)
      ).rejects.toThrow('CSV file contains no data')
    })

    it('should throw error for CSV file with only headers', async () => {
      const csvContent = `name,email,company`

      const csvPath = path.join(testDataDir, 'only-headers.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      await expect(
        templateEngine.parseDataSource(csvPath)
      ).rejects.toThrow('CSV file contains no data')
    })

    it('should handle CSV file with different line endings', async () => {
      // Windows 风格的行结束符 (CRLF)
      const csvContent = `name,email\r\nJohn,john@example.com\r\nJane,jane@example.com`

      const csvPath = path.join(testDataDir, 'test-crlf.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(2)
      expect(records[0].name).toBe('John')
      expect(records[1].name).toBe('Jane')
    })
  })

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      await expect(
        templateEngine.parseDataSource('/path/to/nonexistent.xlsx')
      ).rejects.toThrow('Data source file not found')
    })

    it('should throw error for unsupported file format', async () => {
      const txtPath = path.join(testDataDir, 'test.txt')
      fs.writeFileSync(txtPath, 'test data', 'utf-8')

      await expect(
        templateEngine.parseDataSource(txtPath)
      ).rejects.toThrow('Unsupported data source format: .txt')
    })

    it('should throw error for corrupted Excel file', async () => {
      const corruptedPath = path.join(testDataDir, 'corrupted.xlsx')
      fs.writeFileSync(corruptedPath, 'This is not a valid Excel file', 'utf-8')

      await expect(
        templateEngine.parseDataSource(corruptedPath)
      ).rejects.toThrow('Failed to parse data source')
    })
  })

  describe('Field and Record Parsing', () => {
    it('should correctly parse all fields from Excel', async () => {
      const testData = [
        { 
          field1: 'value1', 
          field2: 'value2', 
          field3: 'value3',
          field4: 'value4',
          field5: 'value5'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-fields.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(1)
      expect(Object.keys(records[0])).toHaveLength(5)
      expect(records[0].field1).toBe('value1')
      expect(records[0].field5).toBe('value5')
    })

    it('should correctly parse all fields from CSV', async () => {
      const csvContent = `field1,field2,field3,field4,field5
value1,value2,value3,value4,value5`

      const csvPath = path.join(testDataDir, 'test-fields.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(1)
      expect(Object.keys(records[0])).toHaveLength(5)
      expect(records[0].field1).toBe('value1')
      expect(records[0].field5).toBe('value5')
    })

    it('should handle large number of records in Excel', async () => {
      // 创建 100 条记录
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }))

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      
      const excelPath = path.join(testDataDir, 'test-large.xlsx')
      XLSX.writeFile(workbook, excelPath)

      const records = await templateEngine.parseDataSource(excelPath)

      expect(records).toHaveLength(100)
      expect(records[0].id).toBe(1)
      expect(records[99].id).toBe(100)
    })

    it('should handle large number of records in CSV', async () => {
      // 创建 100 条记录
      let csvContent = 'id,name,email\n'
      for (let i = 1; i <= 100; i++) {
        csvContent += `${i},User ${i},user${i}@example.com\n`
      }

      const csvPath = path.join(testDataDir, 'test-large.csv')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      const records = await templateEngine.parseDataSource(csvPath)

      expect(records).toHaveLength(100)
      expect(records[0].id).toBe('1')
      expect(records[99].id).toBe('100')
    })
  })
})
