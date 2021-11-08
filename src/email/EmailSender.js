import createDebug from 'debug';
import path from 'path';
import moment from 'moment';
import ExcelJs from 'exceljs';
import fs from 'fs';
import logger from '../logger';
import sendGrid from '@sendgrid/mail';
import dbServer from '../repository/DatabaseRepository';

const debug = createDebug(path.basename(__filename, '.js'));
const availabilities = ['with build', 'no build'];
const shawAvailabilities = ['on-net', 'near-net'];

/**
 * Returns the vendor e-mail addresses corresponding to the given province.
 * @param {string} requestId - The auto-generated Firestore Document ID.
 * @returns {Array} The vendor e-mail addresses.
 */
class EmailSender {
  /**
   * @param {string} requestId - The auto-generated ID of Firestore Document .
   * @param {Object} data - The array data to parse and save as attachment.
   * @example [
   *   {
   *     ADDRESS: '1234 SAMPLE STREET',
   *     OFFERS: [
   *       {
   *          PARTNER_OFFER_NAME: 'Wholesale Business Internet 20'
   *       },
   *       {
   *          PARTNER_OFFER_NAME: 'Wholesale Business Internet 75'
   *       }
   *     ]
   *   }
   * ]
   */
  constructor(requestId, data) {
    debug(`Init email sender with request ID: ${requestId}`);
    this.requestId = requestId;
    this.data = data;
  }

  /**
   * Email sender
   * @param {array} recipient - send emails to
   */
  async send(recipient) {
    debug(`sending email...`);
    let attachmentFilename = undefined;
    try {
      attachmentFilename = await this._buildAttachment();
      const parsedAttachment = fs
        .readFileSync(attachmentFilename)
        .toString('base64');

      const attachment = {
        content: parsedAttachment,
        filename: attachmentFilename,
      };

      const message = await this._buildMessage(recipient, attachment);

      sendGrid
        .send(message)
        .then((response) => {
          // response[0] is ClientResponse from SendGrid
          debug(`Email sent with response: ${response[0]}`);
        })
        .catch((error) => {
          throw new Error(`on send ${error.stack}`);
        });
    } catch (error) {
      logger.error(`on send: ${error.stack}`);
    } finally {
      this._deleteStaticFile(attachmentFilename);
    }
  }

  /**
   * Build email attachment using exceljs node module
   * @returns {string} - attachmentFileName
   */
  async _buildAttachment() {
    const attachmentFilename = `${this.requestId}_${moment().format(
      'YYYYMMDD'
    )}_TELUS_HSIALOOKUP.xlsx`;
    debug('building attachment using generated file:', attachmentFilename);
    try {
      const workbook = new ExcelJs.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(2).width = 50;
      worksheet.getColumn(3).width = 50;
      worksheet.getColumn(4).width = 50;
      worksheet.getColumn(5).width = 50;
      worksheet.getColumn(6).width = 70;

      worksheet.addRow(['Paas Identifier', this.requestId]); // ROW 1
      worksheet.addRow(['Replied by', 'person@company.email.com']); // ROW 2

      const attachmentHeader = [
        'Seq#',
        'LPDSid',
        'Service Address',
        'Max Avail. Offer: Availability',
        'Construction Charge, if applicable',
        'Comments',
      ];
      const rowHeader = worksheet.addRow(attachmentHeader); // ROW 3

      rowHeader.eachCell((cell) => {
        cell.style = {
          alignment: {
            horizontal: 'center',
          },
          font: {
            bold: true,
            size: 14,
          },
          protection: {
            locked: true,
          },
        };
      });

      // hidden items headers for email processor parsing
      worksheet.getCell('N3').value = 'PARTNER_NAME';
      worksheet.getCell('O3').value = 'PROVINCE_ABBREV';

      const partners = this.data.PARTNERS;
      const offers = this.data.OFFERS;
      let hiddenDropdownItemsIndex = 0;
      for (let i = 0, rowIndex = 4, id = 1; i < partners.length; i++) {
        const currId = id + i;
        const currRow = rowIndex + i;

        worksheet.getCell('A' + currRow).value = currId;
        worksheet.getCell('A' + currRow).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };

        worksheet.getCell('B' + currRow).value = partners[i].LPDS_ID;
        worksheet.getCell('B' + currRow).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };

        worksheet.getCell('C' + currRow).value = partners[i].ADDRESS;

        let offerNames = undefined;
        if (offers[i].PARTNER_NAME.toString().toUpperCase() === 'SHAW') {
          worksheet.getCell('D' + currRow).value = `${offers[
            i
          ].OFFER_NAMES[0].toString()} :${shawAvailabilities[0]}`;
          offerNames = this._buildOfferNames(offers[i], shawAvailabilities);
        } else {
          worksheet.getCell('D' + currRow).value = `${offers[
            i
          ].OFFER_NAMES[0].toString()} :${availabilities[0]}`;
          offerNames = this._buildOfferNames(offers[i], availabilities);
        }

        offerNames.push([':Not Available']);

        // last index for hiddenDropdownItemsIndex in Column P
        let lastRowIndexColumnP = currRow + hiddenDropdownItemsIndex;

        // hidden items for email processor parsing
        worksheet.getCell('N' + currRow).value = offers[i].PARTNER_NAME;
        worksheet.getCell('O' + currRow).value = offers[i].PROVINCE_ABBREV;

        for (const offer of Array.prototype.concat.apply([], offerNames)) {
          worksheet.getCell(
            'P' + (currRow + hiddenDropdownItemsIndex)
          ).value = offer;
          hiddenDropdownItemsIndex++;
        }

        worksheet.getCell('D' + currRow).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [
            `$P${lastRowIndexColumnP}:$P$${hiddenDropdownItemsIndex + currRow}`,
            2,
          ],
        };

        worksheet.getCell('E' + currRow).numFmt = '$0.00';
        worksheet.getCell('E' + currRow).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      }

      worksheet.getColumn('N').hidden = true;
      worksheet.getColumn('O').hidden = true;
      worksheet.getColumn('P').hidden = true;

      await workbook.xlsx.writeFile(attachmentFilename);

      return attachmentFilename;
    } catch (error) {
      logger.error(`on _buildAttachment: ${error.stack}`);
    }
  }

  /**
   * Build message to send
   * @param {Array} recipient - The recipient of email
   * @param {File} attachment - The file attachment
   * @returns {string} - The parsed message to use in sending email
   */

  async _buildMessage(recipient, attachment) {
    const {
      SENDER,
      SUBJECT,
      BODY,
      BODY_HTML,
    } = await dbServer.queryGetEmailFormat();
    return {
      to: recipient,
      from: SENDER,
      subject: SUBJECT,
      text: BODY,
      html: BODY_HTML,

      attachments: [
        {
          content: attachment.content,
          filename: attachment.filename,
          type: 'application/vnd.ms-excel',
          disposition: 'attachment',
        },
      ],
      mail_settings: {
        sandbox_mode: {
          enable: false,
        },
      },
    };
  }

  _buildOfferNames(offers, availabilities) {
    return offers.OFFER_NAMES.map((offerName) => {
      return availabilities.map(
        (availability) => `${offerName} :${availability}`
      );
    });
  }

  _deleteStaticFile(attachmentFile) {
    debug('removing static file...');
    try {
      fs.unlinkSync(attachmentFile);

      return true;
    } catch (error) {
      logger.error(`on _deleteStaticFile: ${error.stack}`);
    }
  }
}

export default EmailSender;
