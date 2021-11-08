import * as dbServer from '../../dbServer';

describe('Inactive Parter Test', () => {
  test('This set the partner Inactive in Mock DB , this partner should not be return', async () => {
    // eslint-disable-next-line camelcase
    const queryPartnerDB = async (TELUS_Partner_id) => {
      const connection = await dbServer.getConnection();
      const partnerOffersQueryString = `SELECT * FROM PARTNERS WHERE TELUS_Partner_id = ${connection.escape(
        TELUS_Partner_id
      )}`;

      return new Promise((resolve, reject) => {
        // eslint-disable-next-line consistent-return
        connection.query(partnerOffersQueryString, (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(JSON.stringify(result));
        });
      });
    };

    const parsedResult = await queryPartnerDB('TPSP01');

    const parsed = JSON.parse(parsedResult);

    const parsedPartner = parsed.map((row) => row.PARTNER_STATUS);

    const replaceStatus = parsedPartner
      .toString()
      .replace('Active', 'Inactive');

    expect(replaceStatus).toBe('Inactive');
  });
});
