import { convert } from 'html-to-text';
import { NotationStats } from './types';

/**
 * Tracks Foundry notation occurrences for analysis.
 */
export function createNotationStats(): NotationStats {
  return { uuidRefs: 0, damageRefs: 0, checkRefs: 0, embedRefs: 0, localizeRefs: 0 };
}

/**
 * Checks whether content is entirely @Localize references
 * (meaning it has no real text content we can use).
 */
export function isLocalizeOnly(html: string): boolean {
  const stripped = html
    .replace(/<[^>]*>/g, '')
    .replace(/@Localize\[[^\]]*\]/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * Process @UUID references.
 * @UUID[Compendium.pf2e.conditionitems.Item.Doomed]{Doomed 1} → "Doomed 1"
 * @UUID[Compendium.pf2e.conditionitems.Item.Blinded] → "Blinded" (extract name from path)
 */
function processUuidRefs(html: string, stats?: NotationStats): string {
  // With display text: @UUID[...]{Display Text}
  let result = html.replace(/@UUID\[([^\]]+)\]\{([^}]+)\}/g, (_match, _path, display) => {
    if (stats) stats.uuidRefs++;
    return display;
  });

  // Without display text: @UUID[Compendium.pf2e.xxx.Item.SomeName]
  result = result.replace(/@UUID\[([^\]]+)\]/g, (_match, refPath: string) => {
    if (stats) stats.uuidRefs++;
    // Extract the last segment as name, convert kebab-case to title case
    const segments = refPath.split('.');
    const lastSegment = segments[segments.length - 1] || refPath;
    // Handle "Effect: Name" patterns
    if (lastSegment.includes(':')) {
      return lastSegment.split(':').pop()!.trim();
    }
    // Convert kebab-case to words
    return lastSegment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  return result;
}

/**
 * Process @Damage references.
 * @Damage[6d12[cold]|options:area-damage] → "6d12 cold damage"
 * @Damage[(1d8+6)[void]] → "1d8+6 void damage"
 * @Damage[(ceil(@item.level/2))[persistent,acid]] → "persistent acid damage"
 */
function processDamageRefs(html: string, stats?: NotationStats): string {
  return html.replace(/@Damage\[([^\]]*(?:\[[^\]]*\])*[^\]]*)\]/g, (_match, inner: string) => {
    if (stats) stats.damageRefs++;

    // Strip options (|options:xxx)
    const mainPart = inner.split('|')[0];

    // Extract formula and damage types
    // Pattern: formula[type1,type2]
    const typeMatch = mainPart.match(/\[([^\]]+)\]\s*$/);
    const damageTypes = typeMatch ? typeMatch[1].replace(/,/g, ' ') : '';

    // Extract the formula (everything before the type brackets)
    let formula = typeMatch
      ? mainPart.slice(0, mainPart.lastIndexOf('[')).trim()
      : mainPart.trim();

    // Clean up parentheses around formulas
    formula = formula.replace(/^\((.+)\)$/, '$1');

    // If formula contains @item references, simplify
    if (formula.includes('@item') || formula.includes('ceil(') || formula.includes('floor(')) {
      // Can't resolve dynamic formulas, just show the damage type
      return damageTypes ? `${damageTypes} damage` : 'damage';
    }

    if (formula && damageTypes) {
      return `${formula} ${damageTypes} damage`;
    } else if (formula) {
      return `${formula} damage`;
    } else if (damageTypes) {
      return `${damageTypes} damage`;
    }
    return 'damage';
  });
}

/**
 * Process @Check references.
 * @Check[reflex|dc:29|basic] → "Reflex save (DC 29, basic)"
 * @Check[type:athletics|dc:25] → "Athletics check (DC 25)"
 * @Check[fortitude|dc:20|traits:damaging-effect] → "Fortitude save (DC 20)"
 */
function processCheckRefs(html: string, stats?: NotationStats): string {
  return html.replace(/@Check\[([^\]]+)\]/g, (_match, inner: string) => {
    if (stats) stats.checkRefs++;

    const parts = inner.split('|');
    let checkType = '';
    let dc = '';
    let isBasic = false;

    for (const part of parts) {
      if (part.startsWith('type:')) {
        checkType = part.slice(5);
      } else if (part.startsWith('dc:')) {
        dc = part.slice(3);
      } else if (part === 'basic') {
        isBasic = true;
      } else if (!part.startsWith('options:') && !part.startsWith('traits:') && !checkType) {
        // First unkeyed part is the check type
        checkType = part;
      }
    }

    const typeName = checkType.charAt(0).toUpperCase() + checkType.slice(1);
    const saves = ['reflex', 'fortitude', 'will'];
    const label = saves.includes(checkType.toLowerCase()) ? `${typeName} save` : `${typeName} check`;
    const details: string[] = [];
    if (dc) details.push(`DC ${dc}`);
    if (isBasic) details.push('basic');

    return details.length > 0 ? `${label} (${details.join(', ')})` : label;
  });
}

/**
 * Process @Template references.
 * @Template[cone|distance:30] → "30-foot cone"
 * @Template[emanation|distance:20]{20-foot area} → "20-foot area"
 */
function processTemplateRefs(html: string): string {
  // With display text
  let result = html.replace(/@Template\[([^\]]+)\]\{([^}]+)\}/g, (_match, _inner, display) => {
    return display;
  });

  // Without display text
  result = result.replace(/@Template\[([^\]]+)\]/g, (_match, inner: string) => {
    const parts = inner.split('|');
    const shape = parts[0] || 'area';
    let distance = '';

    for (const part of parts) {
      if (part.startsWith('distance:')) {
        distance = part.slice(9);
      }
    }

    return distance ? `${distance}-foot ${shape}` : shape;
  });

  return result;
}

/**
 * Process @Embed references (cannot be resolved, strip or placeholder).
 */
function processEmbedRefs(html: string, stats?: NotationStats): string {
  return html.replace(/@Embed\[([^\]]+)\](?:\{([^}]+)\})?/g, (_match, _path, display) => {
    if (stats) stats.embedRefs++;
    return display ? `[See: ${display}]` : '';
  });
}

/**
 * Process @Localize references (cannot be resolved, strip).
 */
function processLocalizeRefs(html: string, stats?: NotationStats): string {
  return html.replace(/@Localize\[([^\]]+)\]/g, (_match) => {
    if (stats) stats.localizeRefs++;
    return '';
  });
}

/**
 * Process [[/gmr ...]] roll macros.
 * [[/gmr 1d4 #Recharge Devastating Blast]]{1d4 rounds} → "1d4 rounds"
 * [[/gmr 1d10 #days]]{1d10 days} → "1d10 days"
 */
function processRollMacros(html: string): string {
  // With display text
  let result = html.replace(/\[\[\/[^\]]+\]\]\{([^}]+)\}/g, (_match, display) => {
    return display;
  });
  // Without display text — extract the dice formula
  result = result.replace(/\[\[\/gmr\s+(\S+)[^\]]*\]\]/g, (_match, formula) => {
    return formula;
  });
  // Catch remaining [[...]] macros
  result = result.replace(/\[\[[^\]]*\]\]/g, '');
  return result;
}

/**
 * Process action glyph spans.
 * <span class="action-glyph">1</span> → [one-action]
 * <span class="action-glyph">2</span> → [two-actions]
 * <span class="action-glyph">3</span> → [three-actions]
 * <span class="action-glyph">r</span> or <span class="action-glyph">R</span> → [reaction]
 * <span class="action-glyph">f</span> or <span class="action-glyph">F</span> → [free-action]
 */
function processActionGlyphs(html: string): string {
  const glyphMap: Record<string, string> = {
    '1': '[one-action]',
    'A': '[one-action]',
    '2': '[two-actions]',
    'D': '[two-actions]',
    '3': '[three-actions]',
    'T': '[three-actions]',
    'r': '[reaction]',
    'R': '[reaction]',
    'f': '[free-action]',
    'F': '[free-action]',
  };

  return html.replace(
    /<span\s+class="action-glyph">([^<]+)<\/span>/gi,
    (_match, glyph: string) => {
      return glyphMap[glyph.trim()] || `[${glyph.trim()}-action]`;
    },
  );
}

/**
 * Converts Foundry VTT HTML content to clean plain text.
 *
 * Processing order:
 * 1. Process all Foundry-specific notation (convert to readable text)
 * 2. Convert remaining HTML to plain text
 */
export function htmlToCleanText(html: string, stats?: NotationStats): string {
  if (!html || html.trim().length === 0) return '';

  // Step 1: Process Foundry-specific notation
  let processed = html;
  processed = processActionGlyphs(processed);
  processed = processUuidRefs(processed, stats);
  processed = processDamageRefs(processed, stats);
  processed = processCheckRefs(processed, stats);
  processed = processTemplateRefs(processed);
  processed = processEmbedRefs(processed, stats);
  processed = processLocalizeRefs(processed, stats);
  processed = processRollMacros(processed);

  // Step 2: Convert HTML to plain text
  const text = convert(processed, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'hr', format: 'blockString', options: { string: '---' } },
      { selector: 'table', format: 'dataTable' },
    ],
  });

  // Step 3: Clean up extra whitespace
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}
