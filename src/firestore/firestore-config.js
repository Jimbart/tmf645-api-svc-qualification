import admin from 'firebase-admin';
import serviceAccount from '../../etc/secrets/credentials.json';

const initApp = () => {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
};

let firestoreCon;
const getFirestoreCon = () => {
  if (!firestoreCon) {
    firestoreCon = initApp();
  }

  return firestoreCon;
};

export default getFirestoreCon().firestore();
