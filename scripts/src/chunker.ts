import { ParsedDocument, RuleChunkInput } from './types';
import { MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS } from './config';

/**
 * Splits content at heading boundaries.
 * Looks for lines starting with heading markers (text converted from HTML headings).
 * html-to-text outputs headings as uppercase lines or lines followed by === or ---
 */
function splitAtHeadings(text: string): { heading: string; body: string }[] {
  // Split on lines that look like headings:
  // - Lines that are entirely uppercase and > 3 chars (html-to-text converts h1/h2 to uppercase)
  // - Lines preceded by blank line and followed by content
  const lines = text.split('\n');
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    // Detect heading: uppercase line with at least 3 chars, or line with heading markers
    const trimmed = line.trim();
    const isHeading =
      trimmed.length >= 3 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed) &&
      !/^\d+$/.test(trimmed) && // Not just numbers
      !/^[-=*_]+$/.test(trimmed) && // Not just separators
      !trimmed.startsWith('|'); // Not table rows

    if (isHeading) {
      // Save previous section
      if (currentBody.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
        });
      }
      currentHeading = trimmed;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Don't forget the last section
  if (currentBody.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    });
  }

  return sections;
}

/**
 * Splits text at paragraph boundaries into chunks under maxChars.
 */
function splitAtParagraphs(text: string, maxChars: number, overlap: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Add overlap from the end of the previous chunk
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Chunks a parsed document into one or more RuleChunkInput objects.
 *
 * Strategy:
 * - Content under MAX_CHUNK_CHARS: single chunk
 * - Larger content: split at heading boundaries, then at paragraph boundaries
 * - Each chunk carries the document title as prefix and inherits metadata
 */
export function chunkDocument(doc: ParsedDocument): RuleChunkInput[] {
  const { content, name, category, source, sourceId, sourceFile, metadata } = doc;

  // Small enough for a single chunk
  if (content.length <= MAX_CHUNK_CHARS) {
    return [
      {
        title: name,
        category,
        source,
        content,
        sourceId,
        sourceFile,
        metadata,
      },
    ];
  }

  // Try splitting at headings first
  const sections = splitAtHeadings(content);

  // If we got meaningful sections, try to combine adjacent small ones
  // and split large ones
  if (sections.length > 1) {
    return chunkBySections(sections, doc);
  }

  // No headings found — split at paragraph boundaries
  const textChunks = splitAtParagraphs(content, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
  return textChunks.map((chunk, i) => ({
    title: textChunks.length > 1 ? `${name} (Part ${i + 1})` : name,
    category,
    source,
    content: textChunks.length > 1 ? `${name}\n\n${chunk}` : chunk,
    sourceId,
    sourceFile,
    metadata,
  }));
}

/**
 * Chunks content based on heading sections.
 * Combines small adjacent sections, splits large ones.
 */
function chunkBySections(
  sections: { heading: string; body: string }[],
  doc: ParsedDocument,
): RuleChunkInput[] {
  const { name, category, source, sourceId, sourceFile, metadata } = doc;
  const chunks: RuleChunkInput[] = [];

  let currentTitle = name;
  let currentContent = '';

  for (const section of sections) {
    const sectionText = section.heading
      ? `${section.heading}\n\n${section.body}`
      : section.body;

    // If adding this section would exceed the limit, finalize current chunk
    if (currentContent.length + sectionText.length + 2 > MAX_CHUNK_CHARS && currentContent.length > 0) {
      chunks.push({
        title: currentTitle,
        category,
        source,
        content: `${name}\n\n${currentContent}`,
        sourceId,
        sourceFile,
        metadata,
      });

      currentTitle = section.heading ? `${name} - ${toTitleCase(section.heading)}` : name;
      currentContent = '';
    }

    // If this single section is too large, split it further
    if (sectionText.length > MAX_CHUNK_CHARS) {
      // Finalize any pending content first
      if (currentContent.length > 0) {
        chunks.push({
          title: currentTitle,
          category,
          source,
          content: `${name}\n\n${currentContent}`,
          sourceId,
          sourceFile,
          metadata,
        });
        currentContent = '';
      }

      const subChunks = splitAtParagraphs(sectionText, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
      const sectionTitle = section.heading ? `${name} - ${toTitleCase(section.heading)}` : name;

      for (let i = 0; i < subChunks.length; i++) {
        chunks.push({
          title: subChunks.length > 1 ? `${sectionTitle} (Part ${i + 1})` : sectionTitle,
          category,
          source,
          content: `${name}\n\n${subChunks[i]}`,
          sourceId,
          sourceFile,
          metadata,
        });
      }
      currentTitle = name;
    } else {
      if (section.heading) {
        currentTitle = `${name} - ${toTitleCase(section.heading)}`;
      }
      currentContent += (currentContent ? '\n\n' : '') + sectionText;
    }
  }

  // Finalize remaining content
  if (currentContent.trim().length > 0) {
    chunks.push({
      title: currentTitle,
      category,
      source,
      content: `${name}\n\n${currentContent}`,
      sourceId,
      sourceFile,
      metadata,
    });
  }

  return chunks;
}

/** Convert ALL-CAPS heading to Title Case */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
