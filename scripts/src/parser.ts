import * as fs from 'fs';
import { ParsedDocument, NotationStats } from './types';
import { htmlToCleanText, isLocalizeOnly, createNotationStats } from './html-processor';
import { MIN_CONTENT_CHARS } from './config';

/** Safely access a nested property */
function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Extract common metadata fields from a standard object */
function extractStandardMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  const level = get(data, 'system.level.value');
  if (level !== undefined) meta.level = level;

  const traits = get(data, 'system.traits.value') as string[] | undefined;
  if (traits && traits.length > 0) meta.traits = traits;

  const rarity = get(data, 'system.traits.rarity') as string | undefined;
  if (rarity && rarity !== 'common') meta.rarity = rarity;

  const publication = get(data, 'system.publication') as Record<string, unknown> | undefined;
  if (publication?.remaster) meta.remaster = true;
  if (publication?.license) meta.license = publication.license;

  return meta;
}

/** Extract type-specific metadata */
function extractTypeMetadata(data: Record<string, unknown>, type: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  switch (type) {
    case 'spell': {
      const traditions = get(data, 'system.traits.traditions') as string[] | undefined;
      if (traditions?.length) meta.traditions = traditions;
      const time = get(data, 'system.time.value') as string | undefined;
      if (time) meta.castingTime = time;
      const range = get(data, 'system.range.value') as string | undefined;
      if (range) meta.range = range;
      const duration = get(data, 'system.duration.value') as string | undefined;
      if (duration) meta.duration = duration;
      const defense = get(data, 'system.defense.save.statistic') as string | undefined;
      if (defense) meta.save = defense;
      break;
    }
    case 'feat': {
      const category = get(data, 'system.category') as string | undefined;
      if (category) meta.featCategory = category;
      const actionType = get(data, 'system.actionType.value') as string | undefined;
      if (actionType) meta.actionType = actionType;
      const prereqs = get(data, 'system.prerequisites.value') as Array<{ value: string }> | undefined;
      if (prereqs?.length) meta.prerequisites = prereqs.map((p) => p.value);
      break;
    }
    case 'action': {
      const actionType = get(data, 'system.actionType.value') as string | undefined;
      if (actionType) meta.actionType = actionType;
      const actions = get(data, 'system.actions.value') as number | undefined;
      if (actions !== undefined && actions !== null) meta.actionCost = actions;
      break;
    }
    case 'equipment': {
      const price = get(data, 'system.price.value') as Record<string, unknown> | undefined;
      if (price) meta.price = price;
      const bulk = get(data, 'system.bulk.value') as number | undefined;
      if (bulk !== undefined) meta.bulk = bulk;
      const usage = get(data, 'system.usage.value') as string | undefined;
      if (usage) meta.usage = usage;
      break;
    }
    case 'class': {
      const hp = get(data, 'system.hp') as number | undefined;
      if (hp) meta.hp = hp;
      const keyAbility = get(data, 'system.keyAbility.value') as string[] | undefined;
      if (keyAbility?.length) meta.keyAbility = keyAbility;
      break;
    }
    case 'ancestry': {
      const hp = get(data, 'system.hp') as number | undefined;
      if (hp) meta.hp = hp;
      const speed = get(data, 'system.speed') as number | undefined;
      if (speed) meta.speed = speed;
      const size = get(data, 'system.size') as string | undefined;
      if (size) meta.size = size;
      const vision = get(data, 'system.vision') as string | undefined;
      if (vision) meta.vision = vision;
      const languages = get(data, 'system.languages.value') as string[] | undefined;
      if (languages?.length) meta.languages = languages;
      break;
    }
    case 'deity': {
      const domains = get(data, 'system.domains') as Record<string, unknown> | undefined;
      if (domains) meta.domains = domains;
      const skill = get(data, 'system.skill') as string[] | undefined;
      if (skill?.length) meta.skill = skill;
      const category = get(data, 'system.category') as string | undefined;
      if (category) meta.deityCategory = category;
      break;
    }
    case 'background': {
      const trainedSkills = get(data, 'system.trainedSkills') as Record<string, unknown> | undefined;
      if (trainedSkills) meta.trainedSkills = trainedSkills;
      break;
    }
  }

  return meta;
}

/** Result from parsing a single file */
export interface ParseResult {
  documents: ParsedDocument[];
  skipped: boolean;
  skipReason?: string;
  error?: string;
  notationStats: NotationStats;
}

/** Parse a standard game object (spell, feat, action, etc.) */
function parseStandardObject(
  data: Record<string, unknown>,
  filePath: string,
  category: string,
  stats: NotationStats,
): ParseResult {
  const html = get(data, 'system.description.value') as string | undefined;

  if (!html || html.trim().length === 0) {
    return { documents: [], skipped: true, skipReason: 'empty-description', notationStats: stats };
  }

  if (isLocalizeOnly(html)) {
    return { documents: [], skipped: true, skipReason: 'localize-only', notationStats: stats };
  }

  const content = htmlToCleanText(html, stats);

  if (content.length < MIN_CONTENT_CHARS) {
    return { documents: [], skipped: true, skipReason: 'content-too-short', notationStats: stats };
  }

  const name = (data.name as string) || 'Unknown';
  const sourceId = (data._id as string) || '';
  const type = (data.type as string) || category;
  const publication = get(data, 'system.publication.title') as string | undefined;

  const standardMeta = extractStandardMetadata(data);
  const typeMeta = extractTypeMetadata(data, category);

  return {
    documents: [
      {
        sourceId,
        sourceFile: filePath,
        name,
        type,
        category,
        source: publication || '',
        content,
        metadata: { ...standardMeta, ...typeMeta },
      },
    ],
    skipped: false,
    notationStats: stats,
  };
}

/** Parse a hazard (special structure) */
function parseHazard(
  data: Record<string, unknown>,
  filePath: string,
  stats: NotationStats,
): ParseResult {
  const name = (data.name as string) || 'Unknown';
  const sourceId = (data._id as string) || '';

  // Combine multiple description fields
  const parts: string[] = [];

  const description = get(data, 'system.details.description') as string | undefined;
  if (description) parts.push(htmlToCleanText(description, stats));

  const disable = get(data, 'system.details.disable') as string | undefined;
  if (disable) parts.push(`Disable: ${htmlToCleanText(disable, stats)}`);

  const reset = get(data, 'system.details.reset') as string | undefined;
  if (reset) parts.push(`Reset: ${htmlToCleanText(reset, stats)}`);

  const routine = get(data, 'system.details.routine') as string | undefined;
  if (routine) parts.push(`Routine: ${htmlToCleanText(routine, stats)}`);

  // Extract item actions
  const items = data.items as Array<Record<string, unknown>> | undefined;
  if (items) {
    for (const item of items) {
      const itemName = item.name as string | undefined;
      const itemDesc = get(item, 'system.description.value') as string | undefined;
      if (itemDesc) {
        const cleanDesc = htmlToCleanText(itemDesc, stats);
        if (cleanDesc.length > 0) {
          parts.push(itemName ? `${itemName}: ${cleanDesc}` : cleanDesc);
        }
      }
    }
  }

  const content = parts.filter((p) => p.length > 0).join('\n\n');

  if (content.length < MIN_CONTENT_CHARS) {
    return { documents: [], skipped: true, skipReason: 'content-too-short', notationStats: stats };
  }

  const publication = get(data, 'system.details.publication.title') as string | undefined;
  const level = get(data, 'system.details.level.value') as number | undefined;
  const traits = get(data, 'system.traits.value') as string[] | undefined;
  const rarity = get(data, 'system.traits.rarity') as string | undefined;
  const isComplex = get(data, 'system.details.isComplex') as boolean | undefined;
  const ac = get(data, 'system.attributes.ac.value') as number | undefined;
  const hp = get(data, 'system.attributes.hp.max') as number | undefined;

  const metadata: Record<string, unknown> = {};
  if (level !== undefined) metadata.level = level;
  if (traits?.length) metadata.traits = traits;
  if (rarity && rarity !== 'common') metadata.rarity = rarity;
  if (isComplex) metadata.isComplex = true;
  if (ac !== undefined) metadata.ac = ac;
  if (hp !== undefined) metadata.hp = hp;

  return {
    documents: [
      {
        sourceId,
        sourceFile: filePath,
        name,
        type: 'hazard',
        category: 'hazard',
        source: publication || '',
        content,
        metadata,
      },
    ],
    skipped: false,
    notationStats: stats,
  };
}

/** Parse a journal entry (multiple pages → multiple documents) */
function parseJournal(
  data: Record<string, unknown>,
  filePath: string,
  stats: NotationStats,
): ParseResult {
  const journalName = (data.name as string) || 'Unknown Journal';
  const pages = data.pages as Array<Record<string, unknown>> | undefined;

  if (!pages || pages.length === 0) {
    return { documents: [], skipped: true, skipReason: 'no-pages', notationStats: stats };
  }

  const documents: ParsedDocument[] = [];
  let totalSkipped = 0;

  for (const page of pages) {
    const pageName = (page.name as string) || 'Unknown Page';
    const pageId = (page._id as string) || '';
    const html = get(page, 'text.content') as string | undefined;

    if (!html || html.trim().length === 0) {
      totalSkipped++;
      continue;
    }

    if (isLocalizeOnly(html)) {
      totalSkipped++;
      continue;
    }

    const content = htmlToCleanText(html, stats);

    if (content.length < MIN_CONTENT_CHARS) {
      totalSkipped++;
      continue;
    }

    // Derive a category based on the journal name
    const journalCategory = deriveJournalCategory(journalName);

    documents.push({
      sourceId: pageId,
      sourceFile: filePath,
      name: pageName,
      type: 'journal',
      category: journalCategory,
      source: journalName,
      content,
      metadata: { journalName },
    });
  }

  if (documents.length === 0) {
    return { documents: [], skipped: true, skipReason: 'all-pages-empty', notationStats: stats };
  }

  return { documents, skipped: false, notationStats: stats };
}

/** Map journal names to meaningful categories */
function deriveJournalCategory(journalName: string): string {
  const lower = journalName.toLowerCase();
  if (lower.includes('class')) return 'class-journal';
  if (lower.includes('ancestr')) return 'ancestry-journal';
  if (lower.includes('archetype')) return 'archetype-journal';
  if (lower.includes('domain')) return 'domain-journal';
  if (lower.includes('gm') || lower.includes('screen')) return 'rules';
  if (lower.includes('remaster')) return 'rules';
  if (lower.includes('hero')) return 'rules';
  return 'journal';
}

/**
 * Parses a single JSON file and returns extracted documents.
 */
export function parseFile(filePath: string, category: string): ParseResult {
  const stats = createNotationStats();

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (category === 'journal') {
      return parseJournal(data, filePath, stats);
    }

    if (category === 'hazard') {
      return parseHazard(data, filePath, stats);
    }

    return parseStandardObject(data, filePath, category, stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { documents: [], skipped: true, error: message, notationStats: stats };
  }
}
