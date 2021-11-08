import * as dbServer from '../../dbServer';

describe('FootPrint Duration', () => {
  test('This will mock changes of duration in the Partners table', async () => {
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

    const parsedPartner = parsed.map((row) => row.FOOTPRINT_DURATION);

    //mock replace value in footprint_duration
    const replaceStatus = parsedPartner
      .toString()
      .replace('180', '215');

    expect(replaceStatus).toEqual('215');
  });
});
