import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WatermarkAdder } from './watermark-adder'
import { PptxParser } from './pptx-parser'
import type { WatermarkOptions } from './watermark-adder'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PizZip from 'pizzip'

describe('WatermarkAdder', () => {
  let adder: WatermarkAdder
  let parser: PptxParser
  let tempDir: string
  let testPptxPath: string
  let createdFiles: string[] = []

  beforeEach(async () => {
    adder = new WatermarkAdder()
    parser = new PptxParser()

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-adder-test-'))

    testPptxPath = path.join(tempDir, 'input.pptx')
    await createSimplePptx(testPptxPath)
    createdFiles.push(testPptxPath)
  })

  afterEach(async () => {
    for (const file of createdFiles) {
      try {
        await fs.unlink(file)
      } catch {
      }
    }
    createdFiles = []

    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
    }
  })

  async function createSimplePptx(filePath: string): Promise<void> {
    const zip = new PizZip()

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`)

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`)

    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`)

    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
</p:sld>`)

    const content = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    })

    await fs.writeFile(filePath, content)
  }

  it('adds page watermark to each slide without modifying existing media images', async () => {
    const outputPath = path.join(tempDir, 'output.pptx')
    const options: WatermarkOptions = {
      type: 'text',
      text: 'TEST',
      fontSize: 24,
      fontColor: '000000',
      opacity: 0.5,
      position: 'center',
      applyToImages: false
    }

    const result = await adder.addWatermark(testPptxPath, outputPath, options)

    expect(result.processedSlides).toBeGreaterThan(0)

    const stats = await fs.stat(outputPath)
    expect(stats.size).toBeGreaterThan(0)

    const document = await parser.open(outputPath)
    expect(document.slides.length).toBe(result.processedSlides)
  })
})
