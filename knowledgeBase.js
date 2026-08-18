// Seeds the knowledge base from VisionFund Kenya's own documents, and provides
// the search used by the bot at runtime.
//
// WHAT THE SEED REPLACES
// The original three entries were invented to demonstrate the mechanism —
// a fictional leave policy, made-up loan products, a guessed escalation path.
// A bot that states policy confidently and wrongly is worse than no bot,
// because somebody acts on it.
//
// SOURCES
//   HR Manual, updated January 2026 (106 pages)
//   ICT Facilities Conditions of Use, signed 9 January 2025
//
// WHAT IS DELIBERATELY ABSENT
// Salary bands, merit increase guidelines, the composition of the disciplinary
// committee, and anything about individual staff. Those are not questions a
// chat assistant should answer to whoever asks, and the ICT Conditions of Use
// require material to be handled according to its security classification.
//
// EVERY ANSWER CITES ITS CLAUSE. If somebody disputes what the bot said, the
// clause number is how they check it — and if the manual is revised, the
// citation is how you find what needs updating here.
//
//   node knowledgeBase.js            show what would change
//   node knowledgeBase.js --apply    replace the knowledge base

require('dotenv').config();
const { pool } = require('./db');

const ENTRIES = [
  // ---------------------------------------------------------------- leave
  {
    category: 'leave',
    question: 'How many annual leave days do I get?',
    answer:
      'Twenty-six days a year, accruing at 2.17 days a month, for all cadres of staff after twelve consecutive months of service. ' +
      'Staff on probation qualify to take accrued leave once probation ends. ' +
      'Leave must be used within the financial year — only five days carry forward, and anything above that needs the department head and HR Director to recommend it to the CEO. ' +
      'Days carried forward must be taken in the first four months of the new calendar year. ' +
      '(HR Manual 3.0.1)',
    keywords: ['annual leave', 'leave days', 'holiday', 'entitlement', '26 days', 'carry forward'],
  },
  {
    category: 'leave',
    question: 'How do I apply for leave?',
    answer:
      'Leave is applied for on the Workday system and must be approved by your supervisor before you go. ' +
      'Give your supervisor notice — for leave of more than ten working days, ten working days\' notice is required. ' +
      'For an emergency of one or two days, no notice is required. ' +
      'Your branch or business unit prepares an annual leave schedule at the start of each calendar year and files it with HR by 30 January. ' +
      '(HR Manual 3.0.1.0)',
    keywords: ['apply leave', 'leave application', 'workday', 'leave notice', 'book leave'],
  },
  {
    category: 'leave',
    question: 'What is the leave allowance and when is it paid?',
    answer:
      'Leave allowance is 25% of your monthly gross salary as at the December payroll, paid in December each year, and it is taxable. ' +
      'If you joined during the year it is prorated from your date of employment. ' +
      'Staff who leave without serving the required notice period are not entitled to it. ' +
      '(HR Manual 3.0.1.1)',
    keywords: ['leave allowance', 'december', '25%', 'leave pay'],
  },
  {
    category: 'leave',
    question: 'How much maternity leave am I entitled to?',
    answer:
      'Ninety calendar days on full pay, regardless of how long you have served, and your annual leave entitlement is not forfeited. ' +
      'You may extend it using annual leave if you follow the normal leave procedure. ' +
      'Two months\' notice is required, and you should report the pregnancy as soon as it is detected so cover can be arranged. ' +
      '(HR Manual 3.0.6)',
    keywords: ['maternity', 'pregnancy', 'maternity leave', '90 days'],
  },
  {
    category: 'leave',
    question: 'How much paternity leave am I entitled to?',
    answer:
      'Fourteen calendar days on full pay. Ten working days\' notice is required, and the leave must be taken within six weeks of the birth. ' +
      'You will need to provide a birth notification before proceeding. ' +
      '(HR Manual 3.0.7)',
    keywords: ['paternity', 'paternity leave', 'new baby', '14 days'],
  },
  {
    category: 'leave',
    question: 'What is the sick leave policy?',
    answer:
      'Up to ninety calendar days a year on full pay, extendable by management to a further three months on half pay. ' +
      'Transport, airtime and internet allowances stop during the half-pay period. ' +
      'Tell your supervisor on the first day of illness, and give HR a medical certificate from a doctor within the insurance scheme by the third day. ' +
      'Sick leave can be booked in half days. Beyond ninety days, service may be terminated on medical grounds. ' +
      '(HR Manual 3.0.9)',
    keywords: ['sick leave', 'sick', 'illness', 'medical leave', 'unwell'],
  },
  {
    category: 'leave',
    question: 'What about compassionate or bereavement leave?',
    answer:
      'Up to seven working days per bereavement, for the death or serious illness of an immediate family member — spouse and children — or a relative, meaning father, mother, father-in-law, mother-in-law, brother or sister. ' +
      'A further 21 days may be granted, deducted from annual leave, where management is satisfied the absence needs extending. ' +
      'Notify HR by email; a death certificate or notification supports any benefits claim. ' +
      '(HR Manual 3.0.5)',
    keywords: ['compassionate', 'bereavement', 'funeral', 'death in family', 'emergency leave'],
  },
  {
    category: 'leave',
    question: 'Can I work remotely?',
    answer:
      'Up to two days a week. Request it from your manager and proceed once approval is granted. ' +
      '(HR Manual 3.0.10)',
    keywords: ['remote', 'work from home', 'wfh', 'remote working', 'hybrid'],
  },
  {
    category: 'leave',
    question: 'Do I get study or exam leave?',
    answer:
      'Five exam leave days per financial year. Present your exam timetable and give at least ten working days\' notice so cover can be planned. ' +
      '(HR Manual 3.0.2)',
    keywords: ['exam leave', 'study leave', 'examination', 'studying'],
  },

  // ------------------------------------------------------- assets and equipment
  {
    category: 'assets',
    question: 'Can I move office equipment to another desk or branch?',
    answer:
      'Not without permission from your head of department or branch manager. ' +
      'Office equipment and stationery must not be used for personal purposes. ' +
      'If the move is approved, it should also be recorded in the asset register so the equipment can still be traced. ' +
      '(HR Manual 9.3a)',
    keywords: ['move equipment', 'transfer asset', 'relocate', 'take laptop', 'move furniture'],
  },
  {
    category: 'assets',
    question: 'What happens if equipment issued to me is damaged?',
    answer:
      'You are expected to keep property entrusted to you clean, maintained and handled with care. ' +
      'Costs arising from damage caused by negligence or unauthorised use are met by the employee the property was entrusted to. ' +
      'Each case is treated on its own facts and based on investigation reports, so report damage promptly rather than leaving it to be discovered. ' +
      '(HR Manual 9.3b)',
    keywords: ['damaged', 'broken', 'damage', 'negligence', 'broke my laptop'],
  },
  {
    category: 'assets',
    question: 'Who keeps duplicate keys for furniture, equipment and vehicles?',
    answer:
      'All duplicate keys must be submitted to and kept centrally rather than held personally. ' +
      'Note that the manual is inconsistent on who holds them — section 1.2.6 names the Administrative Manager and section 9.7 names the Administration Officer. ' +
      'Check with the Administration department before handing keys over. ' +
      '(HR Manual 1.2.6c and 9.7)',
    keywords: ['keys', 'duplicate keys', 'safe custody', 'spare key'],
  },
  {
    category: 'assets',
    question: 'What do I do with company assets when I leave?',
    answer:
      'All company assets must be returned on or before your last working day, with a formal handover to a representative of the P&C Department. ' +
      'A clearance form is completed and signed off by each department. ' +
      'Where an asset is not returned, the department records its exact value and Finance deducts that amount from your final dues. ' +
      '(HR Manual 8.10.1 and 8.10.2)',
    keywords: ['leaving', 'resigning', 'clearance', 'exit', 'last day', 'return laptop', 'handover'],
  },
  {
    category: 'assets',
    question: 'How do I report a lost or stolen asset?',
    answer:
      'Report it to your supervisor and to ICT immediately — the sooner a device is reported, the sooner access can be cut off. ' +
      'For a laptop, phone or anything holding company data, this is urgent: the ICT Conditions of Use require confidential material to be protected from unauthorised access by third parties. ' +
      'The asset register records the loss so the item stops being counted as held. ' +
      '(ICT Conditions of Use 21)',
    keywords: ['lost', 'stolen', 'missing', 'lost laptop', 'theft', 'lost phone'],
  },

  // --------------------------------------------------------------- ICT policy
  {
    category: 'it_support',
    question: 'Can I use my own laptop or phone for work?',
    answer:
      'Users take personally owned equipment attached to the VFK network at their own risk, and these conditions still apply to it. ' +
      'Work email must be sent from and stored within the work email system — storing it elsewhere may breach the Information Security Policy. ' +
      '(ICT Conditions of Use, Definitions and 22)',
    keywords: ['own laptop', 'personal device', 'byod', 'my own phone', 'personal computer'],
  },
  {
    category: 'it_support',
    question: 'Can I use company IT facilities for personal things?',
    answer:
      'Yes, within limits. Personal use is allowed provided it does not interfere with your work, does not incur unwarranted expense, does not have a negative impact on VFK, and is otherwise in line with the Conditions of Use. ' +
      'You should also consider other users — for example, not occupying a machine for personal email while colleagues are waiting to use it for work. ' +
      'Be aware that personal information may be inadvertently accessed during enforcement of these conditions, so a third-party email account is worth keeping separate. ' +
      '(ICT Conditions of Use 13, 14 and 22)',
    keywords: ['personal use', 'personal email', 'social media', 'private use', 'facebook'],
  },
  {
    category: 'it_support',
    question: 'Does VFK monitor my email and internet use?',
    answer:
      'VFK carries out routine monitoring of activity to check systems operate correctly and to protect against viruses, malicious attack and other known threats. This does not normally involve monitoring individual communications or disclosing file contents. ' +
      'It reserves the right to monitor use of ICT facilities, including emails and web pages, and to access content: to protect against viruses and hackers; to investigate breaches of these conditions; to prevent or detect crime; when legally required, for example by police investigation or court order; and where necessary for pressing business interests, such as reviewing the email of an employee on long-term sick leave. ' +
      'In all cases, inspection of individual content is only carried out if authorised by the CEO or a VFK Director. ' +
      '(ICT Conditions of Use 11, 12 and 18)',
    keywords: ['monitor', 'monitoring', 'privacy', 'read my email', 'surveillance', 'watched'],
  },
  {
    category: 'it_support',
    question: 'Am I allowed to share my password or username?',
    answer:
      'No. You are responsible for all use of your username, and you must not make your username or password available to anyone else, nor use anyone else\'s. ' +
      'Unauthorised access to accounts, including stealing or misusing a password, is computer misuse and may be an offence under the Information Security and HR Policy. ' +
      '(ICT Conditions of Use 3 and 9e)',
    keywords: ['password', 'share password', 'username', 'account', 'login details'],
  },
  {
    category: 'it_support',
    question: 'Can I install software on my work computer?',
    answer:
      'Software must always be used in accordance with its licence, and copying software without the licence holder\'s permission is prohibited. ' +
      'You must not tamper with the configuration of a VFK computer or any cables and peripherals attached to it, and you must not install or play games on IT facilities. ' +
      '(ICT Conditions of Use 5, 6 and 9a)',
    keywords: ['install', 'software', 'licence', 'license', 'download', 'install app'],
  },
  {
    category: 'it_support',
    question: 'What happens if I breach the ICT Conditions of Use?',
    answer:
      'Breach may result in disciplinary action. Where an allegation is made, ICT may inspect and take copies of any staff member\'s files as evidence — but only if authorised by the CEO or a VFK Director, and with reasonable efforts made to avoid inspecting unrelated files. ' +
      'Your account may be suspended immediately for investigation, and you will be notified wherever possible. ' +
      'Penalties range from temporary or long-term suspension of access to dismissal, and VFK may refer the matter to the relevant security organs. ' +
      '(ICT Conditions of Use 16 to 19)',
    keywords: ['breach', 'disciplinary', 'suspended', 'misuse', 'consequences', 'in trouble'],
  },
  {
    category: 'it_support',
    question: 'Are my files backed up automatically?',
    answer:
      'No — do not assume so. ICT cannot guarantee continuous availability of the facilities or the data saved on them. ' +
      'You should save your work regularly and take frequent backups yourself, either in hard copy or to removable media stored securely. ' +
      '(ICT Conditions of Use 20)',
    keywords: ['backup', 'backed up', 'lost my files', 'saved', 'data loss', 'recover'],
  },
  {
    category: 'it_support',
    question: 'Who do I contact about information security?',
    answer:
      'Contact ICT Information Security via the Service Desk at helpdesk@visionfundkenya.co.ke. ' +
      'That is also the route for any request that would otherwise involve accessing restricted material, such as viewing extremist content for legitimate research purposes. ' +
      '(ICT Conditions of Use 9k)',
    keywords: ['helpdesk', 'service desk', 'contact it', 'support', 'ict', 'who do i contact'],
  },

  // ----------------------------------------------------------------- leaving
  {
    category: 'hr',
    question: 'How much notice do I give if I resign?',
    answer:
      'One month, or one month\'s salary in lieu of notice, for most staff. ' +
      'Employees on probation and temporary employees give one week; interns give two weeks; SLT members give two months. ' +
      'It is VFK\'s decision whether to allow annual leave during the notice period, so plan to serve it in full unless you are told otherwise. ' +
      'You are paid up to your last day worked, plus any unused leave. ' +
      '(HR Manual 8.1)',
    keywords: ['resign', 'notice period', 'quitting', 'leaving', 'resignation', 'one month'],
  },
  {
    category: 'hr',
    question: 'Whose responsibility is it to keep my HR records up to date?',
    answer:
      'Yours. Tell HR when any of these change: your address and phone numbers, your emergency contact, a legal change of name, your marital status, the birth of a child or any change to dependants, and any new academic or professional qualifications with copies of the certificates. ' +
      '(HR Manual 9.1)',
    keywords: ['update records', 'change address', 'next of kin', 'personal details', 'my records'],
  },
];

// Finds entries matching a question, ranked by how many of the asker's words
// each entry actually matches.
//
// An earlier version used LIMIT 3 with no ORDER BY, which returns whichever
// rows Postgres finds first — insertion order. The leave entries were seeded
// first, so "what do I do with company assets when I leave" got three
// annual-leave answers and never saw the clearance entry that matched it
// exactly, scoring 6 against their 2. The model then correctly said it had
// nothing, which read as a gap in the knowledge base rather than a bug here.
async function searchKnowledgeBase(query, category = null) {
  const terms = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (!terms.length) return [];

  const params = [terms];
  let sql = `
    SELECT question, answer, category,
           (SELECT COUNT(*) FROM unnest($1::text[]) AS t
            WHERE LOWER(question) LIKE '%' || t || '%')
         + (SELECT COUNT(*) FROM unnest($1::text[]) AS t
            WHERE EXISTS (SELECT 1 FROM unnest(keywords) AS k
                          WHERE LOWER(k) LIKE '%' || t || '%'))
           AS score
    FROM knowledge_base
    WHERE (
      keywords && $1::text[]
      OR EXISTS (
        SELECT 1 FROM unnest($1::text[]) AS t
        WHERE LOWER(question) LIKE '%' || t || '%'
      )
    )
  `;

  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  sql += ' ORDER BY score DESC, id LIMIT 3';

  const { rows } = await pool.query(sql, params);

  // Only the best match and anything close to it. Passing three loosely-related
  // entries makes the answer vaguer, not better.
  if (!rows.length) return [];
  const best = Number(rows[0].score);
  return rows.filter((r) => Number(r.score) >= best - 1);
}

async function main() {
  const apply = process.argv.includes('--apply');

  const { rows: existing } = await pool.query(
    'SELECT id, category, question FROM knowledge_base ORDER BY id'
  );

  console.log(`Currently in the knowledge base: ${existing.length}`);
  existing.forEach((e) => console.log(`  [${e.category}] ${e.question}`));

  console.log(`\nWould be replaced with ${ENTRIES.length} entries drawn from VFK documents:`);
  const byCategory = {};
  ENTRIES.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + 1; });
  Object.entries(byCategory).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to replace the knowledge base.');
    console.log('The existing entries were invented placeholders and will be deleted.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Replaced wholesale rather than merged: the existing rows are invented and
    // there is nothing in them worth keeping.
    await client.query('DELETE FROM knowledge_base');

    for (const e of ENTRIES) {
      await client.query(
        `INSERT INTO knowledge_base (category, question, answer, keywords)
         VALUES ($1, $2, $3, $4)`,
        [e.category, e.question, e.answer, e.keywords]
      );
    }

    await client.query('COMMIT');
    console.log(`\nSeeded ${ENTRIES.length} entries.`);
    console.log('Every answer cites its clause, so anyone can check it against the source.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nRolled back — nothing was written.');
    throw err;
  } finally {
    client.release();
  }
}

// Only run the seed when invoked directly. Without this, requiring
// searchKnowledgeBase from bot.js would also run the seed report — and its
// pool.end() would close the connection pool the bot is about to use.
if (require.main === module) {
  main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { searchKnowledgeBase };