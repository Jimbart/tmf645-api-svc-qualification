/* eslint-disable jest/valid-expect-in-promise, no-underscore-dangle */
import createDebug from 'debug';
import path from 'path';
import { MailSlurp } from 'mailslurp-client';
import csq from '../../controllers/CheckServiceQualificationController';
import URL from '../../utils/enums/UrlEnum';
//import vendorEmail from '../../vendor_api/VendorEmail';
import * as dbServer from '../../dbServer';


const debug = createDebug(path.basename(__filename, '.js'));
const api = new MailSlurp({ apiKey: URL.MAILSLURP_APIKEY });

csq._sendEmailWithAttachment = jest.fn();

describe('EASTLINK Mock Email Test using MailSlurp', () => {
  test('Should send email to EASTLINK if LPDS_ID found expire or NoFootPrint in Firestore', async () => {
    const sendEmailToEastlink = async () => {

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
      
      const parsedResult = await queryPartnerDB('TPSP06');
      
          const parsed = JSON.parse(parsedResult);
    
          const parsedEmail = parsed.map((row) => row.CONTACT_EMAIL);


      return new Promise((resolve, reject) => {
        const newAmsMap = '125 Catwalk st, Eastlink Mock Address City NB CA';
        //const province = 'NB';

        try {
          //const getEmailsByProvince = vendorEmail(province);
          const mockSendEmailValue = csq._sendEmailWithAttachment.mockReturnValue(
            {
              to: parsedEmail,
              from: 'telusorders@radiant.net',
              subject: 'Check Service Qualification',
              text:
                'Hello, Would it be possible to kindly prequalify the addresses listed in the attached document?',
              html:
                '<strong>Hello,<br /><br /> Would it be possible to kindly prequalify the addresses listed in the attached document?<br /><br /></strong>',
              attachments: [
                {
                  content: Buffer.from(newAmsMap).toString('base64'),
                  filename: 'attachment.csv',
                  type: 'application/csv',
                  disposition: 'attachment',
                },
              ],
              mail_settings: { sandbox_mode: { enable: false } },
              isMultiple: false,
              substitutionWrappers: ['{{', '}}'],
            }
          );

          resolve(mockSendEmailValue());
        } catch (error) {
          debug('ERROR:', error.message);
          reject(error);
        }
      });
    };

    const sendEmailResponse = await sendEmailToEastlink();
    const mailSlurpEmail = async () => {
      const { subject, text, attachments } = sendEmailResponse;
      const { content, type, filename } = attachments[0];
      const file = {
        base64Contents: content.toString('base64'),
        contentType: type,
        filename,
      };

      const attachmentId = await api.uploadAttachment(file);
      // eslint-disable-next-line no-return-await
      return await api.sendEmail(URL.MAILSLURP_INBOX, {
        to: [URL.MAILSLURP_EMAIL_ADDRESS],
        subject,
        body: text,
        attachments: attachmentId,
      });
    };

    const mailSlurpEmailResponse = await mailSlurpEmail();

    expect(mailSlurpEmailResponse.status).toBe(201);
    // Temporary email for development purposes
    expect(sendEmailResponse.to.toString()).toMatch(
      'johndexter.reyes@telusinternational.com'
    );
  });
});
