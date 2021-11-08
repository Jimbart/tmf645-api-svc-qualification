/* eslint-disable no-underscore-dangle */
import createDebug from 'debug';
import path from 'path';
import { MailSlurp } from 'mailslurp-client';
import csq from '../../controllers/CheckServiceQualificationController';
import URL from '../../utils/enums/UrlEnum';
import vendorEmail from '../../vendor_api/VendorEmail';

const debug = createDebug(path.basename(__filename, '.js'));
const api = new MailSlurp({ apiKey: URL.MAILSLURP_APIKEY });

csq._sendEmailWithAttachment = jest.fn();

describe('Test sendEmailWithAttachment method', () => {
  test.skip('It should mock a test email with attachment to MailSlurp Inbox', async () => {
    const sendEmailUnitTest = async () => {
      return new Promise((resolve, reject) => {
        const newAmsMap = '123 Emerald st, Mock Address City';
        const province = 'QC';

        try {
          const getEmailsByProvince = vendorEmail(province);
          const mockSendEmailValue = csq._sendEmailWithAttachment.mockReturnValue(
            {
              to: [...getEmailsByProvince],
              from: 'telusorders@telus.com',
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

    const mockEmailResponse = await sendEmailUnitTest();
    const mailSlurpEmail = async () => {
      const { subject, text, attachments } = mockEmailResponse;
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
    expect(mockEmailResponse.to.toString()).toMatch(
      'jimbit0077@gmail.com',
      'lendlycagata@gmail.com'
    );
  });
});
