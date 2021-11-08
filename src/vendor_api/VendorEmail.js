import 'dotenv/config';
import createDebug from 'debug';
import mysql from 'mysql';
import path from 'path';
import util from 'util';

const debug = createDebug(path.basename(__filename, '.js'));

/**
 * Returns the vendor e-mail addresses corresponding to the given province.
 * @param {string} province - The province code.
 * @returns {Array} The vendor e-mail addresses.
 */
const getVendorEmailAddresses = async (province) => {
  const connection = mysql.createConnection({
    database: process.env.OFFNET_MYSQL_SCHEMA,
    user: process.env.OFFNET_MYSQL_USER,
    password: process.env.OFFNET_MYSQL_PASS,
  });
  await util.promisify(connection.connect).bind(connection)();
  const results = await util
    .promisify(connection.query)
    .bind(
      connection
    )(
    'SELECT DISTINCT CONTACT_EMAIL FROM PARTNERS INNER JOIN PARTNER_OFFERS ON PARTNERS.TELUS_PARTNER_ID = PARTNER_OFFERS.TELUS_PARTNER_ID WHERE PROVINCE_ABBREV = ?',
    [province]
  );
  const emailAddresses = results.reduce(
    (a, v) => a.concat(v.CONTACT_EMAIL),
    []
  );
  await util.promisify(connection.end).bind(connection)();
  debug('vendor e-mail addresses %o', emailAddresses);
  return emailAddresses;
};

export default getVendorEmailAddresses;
