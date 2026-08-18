// What is being asked? Order matters — the most specific pattern wins, because
// "who has laptop KDT001981" contains inventory words but is really a lookup of
// one asset.
function detectIntent(text) {
  const lower = text.toLowerCase();

  // An asset code has a fixed shape, so its presence is decisive.
  if (/\b(?:vfk|kdt|nc|eqp|c&p)[\s-]?\d{3,6}\b/i.test(text)) return 'asset_lookup';

  // Questions about a person and what they hold.
  const peoplePatterns = [
    /what (?:assets?|equipment|devices?|items?) (?:does|has|is)/,
    /who (?:has|holds|is holding|was issued)/,
    /assigned to/,
    /issued to/,
    /\bholding\b/,
  ];
  if (peoplePatterns.some((p) => p.test(lower))) return 'employee_lookup';

    // Policy topics are checked BEFORE inventory keywords, because "how many days
  // annual leave" contains "how many" and would otherwise be treated as a
  // stock question — then answered from an empty context.
  const policyKeywords = [
    'leave', 'holiday', 'maternity', 'paternity', 'sick', 'compassionate',
    'bereavement', 'remote', 'work from home', 'exam', 'notice period',
    'resign', 'clearance', 'allowance', 'policy', 'entitled', 'entitlement',
  ];
  if (policyKeywords.some((k) => lower.includes(k))) return 'general';

  const inventoryKeywords = [
    'tablet', 'laptop', 'device', 'asset', 'branch', 'how many',
    'stock', 'inventory', 'serial number', 'vehicle', 'furniture',
  ];
  const itSupportKeywords = [
    'not working', 'error', 'bios', 'driver', 'screen', "won't turn on",
    'wont turn on', 'blue screen', 'reset', 'troubleshoot', 'password',
  ];

  if (inventoryKeywords.some((k) => lower.includes(k))) return 'inventory';
  if (itSupportKeywords.some((k) => lower.includes(k))) return 'it_support';
  return 'general';
}

module.exports = { detectIntent };