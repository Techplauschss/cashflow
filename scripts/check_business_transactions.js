const admin = require('firebase-admin');
const path = require('path');

// Lade Service-Account JSON
const serviceAccountPath = path.join(__dirname, '..', 'src', 'cashflow-e8354-firebase-adminsdk-fbsvc-af14d8ae4b.json');
const serviceAccount = require(serviceAccountPath);

// Versuche, eine sinnvolle databaseURL zu verwenden
const databaseURL = process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL,
});

const db = admin.database();

(async () => {
  try {
    const snapshot = await db.ref('transactions').once('value');
    const data = snapshot.val();

    if (!data) {
      console.log('Keine Transaktionen in der Realtime-DB gefunden.');
      process.exit(0);
    }

    const entries = Object.entries(data).map(([id, tx]) => ({ id, ...(tx || {}) }));

    const total = entries.length;
    const businessTrue = entries.filter(e => e.isBusiness === true).length;
    const businessFalse = entries.filter(e => e.isBusiness === false).length;
    const businessMissing = entries.filter(e => typeof e.isBusiness === 'undefined').length;

    console.log('Transaktionen insgesamt:', total);
    console.log('isBusiness === true:', businessTrue);
    console.log('isBusiness === false:', businessFalse);
    console.log('isBusiness fehlt (undefined):', businessMissing);

    if (businessTrue > 0) {
      console.log('\nBeispielhafte Geschäftstransaktionen (max 10):');
      entries.filter(e => e.isBusiness === true).slice(0, 10).forEach(e => {
        console.log(`- ${e.id}: ${e.description} | ${e.date} | ${e.amount}`);
      });
    }

    if (businessMissing > 0) {
      console.log('\nBeispielhafte Transaktionen ohne isBusiness (max 10):');
      entries.filter(e => typeof e.isBusiness === 'undefined').slice(0, 10).forEach(e => {
        console.log(`- ${e.id}: ${e.description} | ${e.date} | ${e.amount}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Fehler beim Lesen der Transaktionen:', err);
    process.exit(1);
  }
})();
