/* eslint-disable no-underscore-dangle */
import {} from 'dotenv/config';
import soapRequest from 'easy-soap-request';
import fs from 'fs';
import URL from '../utils/enums/UrlEnum';
import PayloadConverter from './PayloadConverter';

const { SHAW_USER, SHAW_PASS } = process.env;

class ShawApi extends PayloadConverter {
  constructor() {
    super();
    this._headers = { 'Content-Type': 'text/xml;charset=UTF-8' };
  }

  getTariffInfo(searchParamValue) {
    return (async () => {
      const jsonTemplate = JSON.parse(
        fs.readFileSync(
          `${__dirname}/request_template/shaw_request_template.json`
        )
      );
      const updatedJsonTemplate = JSON.parse(
        JSON.stringify(jsonTemplate)
          .replace(/\$OFFNET_SHAW_API_USER/, SHAW_USER)
          .replace(/\$OFFNET_SHAW_API_PASS/, SHAW_PASS)
      );

      super.setJsonObjectValue(
        updatedJsonTemplate,
        'sel:InputParameter',
        searchParamValue
      );
      const xmlPayload = super.parseToXml(
        JSON.stringify(updatedJsonTemplate, 0, 2)
      );

      const { response } = await soapRequest({
        url: URL.GET_TARIFFS_INFO,
        headers: this._headers,
        xml: xmlPayload,
      });

      return response;
    })();
  }

  // returns available offers
  getParsedTariffData(tariffInfoParam) {
    const result = super.parseToJson(tariffInfoParam);

    const envelope = result['soap:Envelope'];
    const envelopeBody = envelope['soap:Body'];

    const tariffsInfo = envelopeBody
      .flatMap((data) => data.GetTariffsInfoResponse)
      .flatMap((data) => data.GetTariffsInfoResult)
      .flatMap((data) => data.OutputParameterSets)
      .flatMap((data) => data.OutputParameterSet)
      .flatMap((data) => data.OutputParameters)
      .flatMap((data) => data.OutputParameter);

    return tariffsInfo;
  }

  // returns tariffsInfoResult object
  getParsedTariffsInfoResult(tariffInfoParam) {
    const result = super.parseToJson(tariffInfoParam);

    const envelope = result['soap:Envelope'];
    const envelopeBody = envelope['soap:Body'];

    const tariffsInfoResult = envelopeBody
      .flatMap((data) => data.GetTariffsInfoResponse)
      .flatMap((data) => data.GetTariffsInfoResult);

    return tariffsInfoResult;
  }
}

export default ShawApi;
