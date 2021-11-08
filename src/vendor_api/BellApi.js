/* eslint-disable global-require, no-shadow, no-underscore-dangle */
import {} from 'dotenv/config';
import soapRequest from 'easy-soap-request';
import fs from 'fs';
import URL from '../utils/enums/UrlEnum';
import STANDARD from '../utils/enums/StandardEnum';
import PayloadConverter from './PayloadConverter';

const { BELL_USER, BELL_PASS } = process.env;

class BellApi extends PayloadConverter {
  constructor() {
    super();

    this._encodedCreds = Buffer.from(`${BELL_USER}:${BELL_PASS}`).toString(
      STANDARD.TO_BASE64
    );
    this._url = URL.GET_PRESALE_PRODUCTS;
    this._headers = {
      'user-agent': 'get_shaw_api',
      'Content-Type': 'text/xml;charset=UTF-8',
      Authorization: `Basic ${this._encodedCreds}`,
    };
  }

  getPresaleProducts(searchParamValue) {
    return (async () => {
      const jsonTemplate = JSON.parse(
        fs.readFileSync(
          `${__dirname}/request_template/bell_request_template.json`
        )
      );
      super.setJsonObjectValue(jsonTemplate, 'address', searchParamValue);
      const xmlPayload = super.parseToXml(JSON.stringify(jsonTemplate, 0, 2));

      const { response } = await soapRequest({
        url: this._url,
        headers: this._headers,
        xml: xmlPayload,
      });

      return response;
    })();
  }

  // returns available products
  getParsedPresaleProducts(presaleProductsParam) {
    try {
      const result = super.parseToJson(presaleProductsParam);

      const envelope = result['soapenv:Envelope'];
      const envelopeBody = envelope['soapenv:Body'];

      const getPresaleProducts = envelopeBody
        .flatMap((data) => data.getPresaleProductsResponse)
        .flatMap((data) => data.getPresaleProductsReturn)
        .flatMap((data) => data.servicePointInformation)
        .flatMap((data) => data.servicePointCharacteristicsList)
        .flatMap((data) => data.servicePointCharacteristics)
        .flatMap((data) => data.propertyLst)
        .flatMap((data) => data.property);

      return getPresaleProducts;
    } catch (error) {
      return 'No Offer.';
    }
  }

  // returns getParsedPresaleProductsReturn object
  getParsedPresaleProductsReturn(presaleProductsParam) {
    const result = super.parseToJson(presaleProductsParam);

    const envelope = result['soapenv:Envelope'];
    const envelopeBody = envelope['soapenv:Body'];

    const getPresaleProductsReturnData = envelopeBody
      .flatMap((data) => data.getPresaleProductsResponse)
      .flatMap((data) => data.getPresaleProductsReturn);

    return getPresaleProductsReturnData;
  }

  _stub() {
    return (async () => {
      const fs = require('fs');
      const payload = fs.readFileSync(
        'vendor_api/test_stubs/bell_response_stub1.xml',
        'utf-8'
      );
      const result = super.parseToJson(payload);

      const envelope = result['soapenv:Envelope'];
      const envelopeBody = envelope['soapenv:Body'];

      const getPresaleProducts = envelopeBody
        .flatMap((data) => data.getPresaleProductsResponse)
        .flatMap((data) => data.getPresaleProductsReturn);

      return getPresaleProducts;
    })();
  }
}

export default BellApi;
