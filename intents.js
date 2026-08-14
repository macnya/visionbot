function detectIntent(text) {
  const lower = text.toLowerCase();

  const inventoryKeywords = ['tablet', 'laptop', 'device', 'asset', 'branch', 'how many', 'stock', 'inventory', 'serial number'];
  const itSupportKeywords = ['not working', 'error', 'bios', 'driver', 'screen', 'won\'t turn on', 'blue screen', 'reset', 'troubleshoot'];

  if (inventoryKeywords.some(k => lower.includes(k))) return 'inventory';
  if (itSupportKeywords.some(k => lower.includes(k))) return 'it_support';
  return 'general';
}

module.exports = { detectIntent };