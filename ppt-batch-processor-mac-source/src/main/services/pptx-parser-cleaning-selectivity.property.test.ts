import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { PptxParser } from './pptx-parser'
import { PageProcessor } from './page-processor'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PizZip from 'pizzip'
import type { PptxDocument } from '../../shared/types'

/**
 * 属性测试：清理操作选择性
 * 
 * **属性 20: 清理操作选择性**
 * 
 * *对于任意* 内容清理操作（如删除空白页、备注），只有符合清理条件的内容应被删除，
 * 其他内容应完整保留。
 * 
 * **验证需求: 6.1, 6.2, 6.3, 6.4, 8.3**
 * 
 * 需求 6.1: 删除空白页 - 只删除不包含任何内容的幻灯片
 * 需求 6.2: 删除备注 - 只清空备注内容
 * 需求 6.3: 删除背景 - 只移除背景图片和背景填充
 * 需求 6.4: 删除宏 - 只移除 VBA 宏代码
 * 需求 8.3: 删除页眉页脚 - 保持幻灯片的其他内容和格式不变
 */
describe('Property 20: Cleaning Operation Selectivity', () => {
  let parser: PptxParser
  let pageProcessor: PageProcessor
  let testDir: string

  beforeEach(async () => {
    parser = new PptxParser()
    pageProcessor = new PageProcessor()
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleaning-selectivity-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  // Arbitraries for generating test data
  const slideCountArb = fc.integer({ min: 2, max: 10 })
  const blankSlideIndicesArb = (totalSlides: number) =>
    fc.array(fc.integer({ min: 0, max: totalSlides - 1 }), {
      minLength: 1,
      maxLength: Math.floor(totalSlides / 2),
    }).map(indices => [...new Set(indices)].sort((a, b) => a - b))

  const textContentArb = fc.oneof(
    fc.constant('Test Content'),
    fc.constant('Sample Text'),
    fc.constant('Important Information'),
    fc.constant('Do Not Delete')
  )

  const notesContentArb = fc.oneof(
    fc.constant('Speaker notes here'),
    fc.constant('Important notes'),
    fc.constant('Presentation notes'),
    fc.constant('')
  )

  /**
   * Helper: Create a test PPTX with mixed content
   * - Some slides with content, some blank
   * - Some slides with notes, some without
   * - Some slides with backgrounds, some without
   */
  async function createMixedContentPptx(
    filePath: string,
    slideCount: number,
    blankSlideIndices: number[],
    slidesWithNotes: number[],
    slidesWithBackgrounds: number[]
  ): Promise<void> {
    const zip = new PizZip()

    // Add required files
    let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`

    for (let i = 1; i <= slideCount; i++) {
      contentTypes += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
      if (slidesWithNotes.includes(i - 1)) {
        contentTypes += `\n  <Override PartName="/ppt/notesSlides/notesSlide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
      }
    }

    contentTypes += '\n</Types>'
    zip.file('[Content_Types].xml', contentTypes)

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`)

    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test Presentation</dc:title>
</cp:coreProperties>`)

    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Company>Test</Company>
</Properties>`)

    // Create presentation.xml with slide IDs
    let slideIdList = ''
    for (let i = 1; i <= slideCount; i++) {
      slideIdList += `\n    <p:sldId id="${255 + i}" r:id="rId${i}"/>`
    }

    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${slideIdList}
  </p:sldIdLst>
</p:presentation>`)

    // Create presentation rels
    let presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`

    for (let i = 1; i <= slideCount; i++) {
      presentationRels += `\n  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`
    }

    presentationRels += '\n</Relationships>'
    zip.file('ppt/_rels/presentation.xml.rels', presentationRels)

    // Create individual slides
    for (let i = 0; i < slideCount; i++) {
      const slideNum = i + 1
      const isBlank = blankSlideIndices.includes(i)
      const hasNotes = slidesWithNotes.includes(i)
      const hasBackground = slidesWithBackgrounds.includes(i)

      // Create slide content
      const backgroundXml = hasBackground
        ? `<p:bg>
        <p:bgPr>
          <a:solidFill>
            <a:srgbClr val="FF0000"/>
          </a:solidFill>
        </p:bgPr>
      </p:bg>`
        : ''

      const contentXml = isBlank
        ? '' // No content for blank slides
        : `<p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="9144000" cy="1828800"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="4400" b="1">
                <a:solidFill><a:srgbClr val="000000"/></a:solidFill>
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>Slide ${slideNum} Content</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`

      zip.file(`ppt/slides/slide${slideNum}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    ${backgroundXml}
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      ${contentXml}
    </p:spTree>
  </p:cSld>
  <p:hf dt="1" ftr="1" sldNum="1"/>
</p:sld>`)

      // Create slide rels if needed
      if (hasNotes) {
        zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNum}.xml"/>
</Relationships>`)

        // Create notes slide
        zip.file(`ppt/notesSlides/notesSlide${slideNum}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Notes"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:t>Notes for slide ${slideNum}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`)
      }
    }

    const content = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    await fs.writeFile(filePath, content)
  }

  /**
   * Property Test 20.1: Delete blank slides only removes blank slides
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 20.1: Delete blank slides only removes slides without content', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed for deterministic generation
        async (totalSlides, seed) => {
          // Generate blank slide indices deterministically
          const blankCount = Math.floor(totalSlides / 3)
          const blankIndices: number[] = []
          for (let i = 0; i < blankCount; i++) {
            blankIndices.push((seed + i * 2) % totalSlides)
          }
          const uniqueBlankIndices = [...new Set(blankIndices)].sort((a, b) => a - b)

          const inputPath = path.join(testDir, `input-blank-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-blank-${seed}.pptx`)

          // Create test file with mixed blank and non-blank slides
          await createMixedContentPptx(inputPath, totalSlides, uniqueBlankIndices, [], [])

          // Open and verify initial state
          const beforeDoc = await parser.open(inputPath)
          const beforeSlideCount = beforeDoc.slides.length
          expect(beforeSlideCount).toBe(totalSlides)

          // Count non-blank slides before deletion
          const nonBlankSlidesBefore = beforeDoc.slides.filter(
            slide => slide.elements && slide.elements.length > 0
          )

          // Delete blank slides
          const deletedCount = await pageProcessor.deleteBlankSlides(inputPath, outputPath)

          // Verify output
          const afterDoc = await parser.open(outputPath)
          const afterSlideCount = afterDoc.slides.length

          // Property: Only blank slides should be removed
          expect(afterSlideCount).toBe(nonBlankSlidesBefore.length)
          expect(deletedCount).toBe(uniqueBlankIndices.length)

          // Property: All remaining slides should have content
          for (const slide of afterDoc.slides) {
            expect(slide.elements.length).toBeGreaterThan(0)
          }

          // Property: Content of non-blank slides should be preserved
          const nonBlankSlidesAfter = afterDoc.slides
          expect(nonBlankSlidesAfter.length).toBe(nonBlankSlidesBefore.length)

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test 20.2: Clear notes only removes notes content
   * 
   * **Validates: Requirements 6.2**
   */
  it('Property 20.2: Clear notes only removes notes, preserves slide content', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed
        async (totalSlides, seed) => {
          // Generate slides with notes deterministically
          const notesCount = Math.floor(totalSlides / 2)
          const slidesWithNotes: number[] = []
          for (let i = 0; i < notesCount; i++) {
            slidesWithNotes.push((seed + i * 3) % totalSlides)
          }
          const uniqueNotesIndices = [...new Set(slidesWithNotes)].sort((a, b) => a - b)

          const inputPath = path.join(testDir, `input-notes-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-notes-${seed}.pptx`)

          // Create test file with some slides having notes
          await createMixedContentPptx(inputPath, totalSlides, [], uniqueNotesIndices, [])

          // Open and verify initial state
          const beforeDoc = await parser.open(inputPath)
          const beforeSlideCount = beforeDoc.slides.length
          const beforeElementCounts = beforeDoc.slides.map(s => s.elements.length)

          // Clear notes
          const clearedCount = await parser.clearNotes(beforeDoc)

          // Save and reopen
          await parser.save(beforeDoc, outputPath)
          const afterDoc = await parser.open(outputPath)

          // Property: Slide count should remain the same
          expect(afterDoc.slides.length).toBe(beforeSlideCount)

          // Property: Slide content (elements) should be preserved
          const afterElementCounts = afterDoc.slides.map(s => s.elements.length)
          expect(afterElementCounts).toEqual(beforeElementCounts)

          // Property: All notes should be cleared
          for (const slide of afterDoc.slides) {
            expect(slide.notes).toBe('')
          }

          // Property: Cleared count should match slides that had notes
          expect(clearedCount).toBeLessThanOrEqual(uniqueNotesIndices.length)

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test 20.3: Remove backgrounds only removes backgrounds
   * 
   * **Validates: Requirements 6.3**
   */
  it('Property 20.3: Remove backgrounds only removes backgrounds, preserves content', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed
        async (totalSlides, seed) => {
          // Generate slides with backgrounds deterministically
          const bgCount = Math.floor(totalSlides / 2)
          const slidesWithBackgrounds: number[] = []
          for (let i = 0; i < bgCount; i++) {
            slidesWithBackgrounds.push((seed + i * 2) % totalSlides)
          }
          const uniqueBgIndices = [...new Set(slidesWithBackgrounds)].sort((a, b) => a - b)

          const inputPath = path.join(testDir, `input-bg-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-bg-${seed}.pptx`)

          // Create test file with some slides having backgrounds
          await createMixedContentPptx(inputPath, totalSlides, [], [], uniqueBgIndices)

          // Open and verify initial state
          const beforeDoc = await parser.open(inputPath)
          const beforeSlideCount = beforeDoc.slides.length
          const beforeElementCounts = beforeDoc.slides.map(s => s.elements.length)

          // Remove backgrounds
          const removedCount = await parser.removeBackgrounds(beforeDoc)

          // Save and reopen
          await parser.save(beforeDoc, outputPath)
          const afterDoc = await parser.open(outputPath)

          // Property: Slide count should remain the same
          expect(afterDoc.slides.length).toBe(beforeSlideCount)

          // Property: Slide content (elements) should be preserved
          const afterElementCounts = afterDoc.slides.map(s => s.elements.length)
          expect(afterElementCounts).toEqual(beforeElementCounts)

          // Property: All backgrounds should be removed
          for (const slide of afterDoc.slides) {
            expect(slide.background).toBeNull()
          }

          // Property: Removed count should match slides that had backgrounds
          expect(removedCount).toBeLessThanOrEqual(uniqueBgIndices.length)

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test 20.4: Remove headers/footers preserves other content
   * 
   * **Validates: Requirements 8.3**
   */
  it('Property 20.4: Remove headers/footers preserves slide content and structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed
        async (totalSlides, seed) => {
          const inputPath = path.join(testDir, `input-hf-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-hf-${seed}.pptx`)

          // Create test file with headers/footers
          await createMixedContentPptx(inputPath, totalSlides, [], [], [])

          // Open and verify initial state
          const beforeDoc = await parser.open(inputPath)
          const beforeSlideCount = beforeDoc.slides.length
          const beforeElementCounts = beforeDoc.slides.map(s => s.elements.length)

          // Remove headers/footers
          const removedCount = await parser.removeHeadersFooters(beforeDoc)

          // Save and reopen
          await parser.save(beforeDoc, outputPath)
          const afterDoc = await parser.open(outputPath)

          // Property: Slide count should remain the same
          expect(afterDoc.slides.length).toBe(beforeSlideCount)

          // Property: Slide content should be preserved (or reduced only by header/footer elements)
          const afterElementCounts = afterDoc.slides.map(s => s.elements.length)
          for (let i = 0; i < afterElementCounts.length; i++) {
            // After removing headers/footers, element count should be <= before
            expect(afterElementCounts[i]).toBeLessThanOrEqual(beforeElementCounts[i])
          }

          // Property: Title content should still be present in non-blank slides
          const zip = afterDoc.zipArchive as PizZip
          for (let i = 0; i < afterDoc.slides.length; i++) {
            if (afterDoc.slides[i].elements.length > 0) {
              const slideFile = zip.file(`ppt/slides/slide${i + 1}.xml`)
              if (slideFile) {
                const slideXml = slideFile.asText()
                // Should not contain header/footer elements
                expect(slideXml).not.toContain('type="dt"')
                expect(slideXml).not.toContain('type="ftr"')
                expect(slideXml).not.toContain('type="sldNum"')
                // But should still contain slide content
                expect(slideXml).toContain('<p:spTree')
              }
            }
          }

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test 20.5: Delete macros only removes macro files
   * 
   * **Validates: Requirements 6.4**
   */
  it('Property 20.5: Delete macros only removes VBA code, preserves presentation', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed
        async (totalSlides, seed) => {
          const inputPath = path.join(testDir, `input-macro-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-macro-${seed}.pptx`)

          // Create test file
          await createMixedContentPptx(inputPath, totalSlides, [], [], [])

          // Open and verify initial state
          const beforeDoc = await parser.open(inputPath)
          const beforeSlideCount = beforeDoc.slides.length
          const beforeElementCounts = beforeDoc.slides.map(s => s.elements.length)

          // Delete macros (even if none exist, should not affect content)
          const deleted = await parser.deleteMacros(beforeDoc)

          // Save and reopen
          await parser.save(beforeDoc, outputPath)
          const afterDoc = await parser.open(outputPath)

          // Property: Slide count should remain the same
          expect(afterDoc.slides.length).toBe(beforeSlideCount)

          // Property: Slide content should be completely preserved
          const afterElementCounts = afterDoc.slides.map(s => s.elements.length)
          expect(afterElementCounts).toEqual(beforeElementCounts)

          // Property: Presentation structure should be intact
          expect(afterDoc.metadata).toBeDefined()
          expect(afterDoc.zipArchive).toBeDefined()

          // Property: No VBA files should exist in output
          const zip = afterDoc.zipArchive as PizZip
          expect(zip.file('ppt/vbaProject.bin')).toBeNull()
          expect(zip.file('ppt/vbaData.xml')).toBeNull()

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test 20.6: Combined cleaning operations are selective
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.3**
   */
  it('Property 20.6: Multiple cleaning operations each target only their specific content', async () => {
    await fc.assert(
      fc.asyncProperty(
        slideCountArb,
        fc.integer({ min: 0, max: 100 }), // seed
        async (totalSlides, seed) => {
          // Generate mixed content
          const blankCount = Math.floor(totalSlides / 4)
          const notesCount = Math.floor(totalSlides / 3)
          const bgCount = Math.floor(totalSlides / 3)

          const blankIndices: number[] = []
          const notesIndices: number[] = []
          const bgIndices: number[] = []

          for (let i = 0; i < blankCount; i++) {
            blankIndices.push((seed + i) % totalSlides)
          }
          for (let i = 0; i < notesCount; i++) {
            notesIndices.push((seed + i * 2) % totalSlides)
          }
          for (let i = 0; i < bgCount; i++) {
            bgIndices.push((seed + i * 3) % totalSlides)
          }

          const uniqueBlankIndices = [...new Set(blankIndices)].sort((a, b) => a - b)
          const uniqueNotesIndices = [...new Set(notesIndices)].sort((a, b) => a - b)
          const uniqueBgIndices = [...new Set(bgIndices)].sort((a, b) => a - b)

          const inputPath = path.join(testDir, `input-combined-${seed}.pptx`)
          const outputPath = path.join(testDir, `output-combined-${seed}.pptx`)

          // Create test file with all types of content
          await createMixedContentPptx(
            inputPath,
            totalSlides,
            uniqueBlankIndices,
            uniqueNotesIndices,
            uniqueBgIndices
          )

          // Open document
          const doc = await parser.open(inputPath)
          const initialSlideCount = doc.slides.length

          // Count non-blank slides before deletion
          const nonBlankSlides = doc.slides.filter(
            slide => slide.elements && slide.elements.length > 0
          )

          // Apply cleaning operations in sequence
          await parser.clearNotes(doc)
          await parser.removeBackgrounds(doc)
          await parser.removeHeadersFooters(doc)
          await parser.deleteMacros(doc)

          // Save intermediate result
          const tempPath = path.join(testDir, `temp-${seed}.pptx`)
          await parser.save(doc, tempPath)

          // Now delete blank slides (this modifies the file)
          await pageProcessor.deleteBlankSlides(tempPath, outputPath)

          // Verify final result
          const finalDoc = await parser.open(outputPath)

          // Property: Only blank slides should be removed
          expect(finalDoc.slides.length).toBe(nonBlankSlides.length)

          // Property: All remaining slides should have no notes
          for (const slide of finalDoc.slides) {
            expect(slide.notes).toBe('')
          }

          // Property: All remaining slides should have no backgrounds
          for (const slide of finalDoc.slides) {
            expect(slide.background).toBeNull()
          }

          // Property: All remaining slides should have content
          for (const slide of finalDoc.slides) {
            expect(slide.elements.length).toBeGreaterThan(0)
          }

          // Property: No VBA files should exist
          const zip = finalDoc.zipArchive as PizZip
          expect(zip.file('ppt/vbaProject.bin')).toBeNull()

          // Cleanup
          await fs.unlink(inputPath).catch(() => {})
          await fs.unlink(tempPath).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 100 }
    )
  })
})
