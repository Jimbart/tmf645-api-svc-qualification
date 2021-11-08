import {} from 'dotenv/config';
import axios from 'axios';
import createDebug from 'debug';
import https from 'https';
import path from 'path';
import querystring from 'querystring';
import fs from 'fs';
import URL from '../utils/enums/UrlEnum';

const debug = createDebug(path.basename(__filename, '.js'));
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Retrieves client credentials to be used for calling other APIs.
 * @async
 * @function getClientCredentials
 * @return {Promise<Object>} The client credentials object containing the access token.
 */
const getClientCredentials = async () => {
  let headerList = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (process.env.AMS_ENV) {
    headerList.env = process.env.AMS_ENV;
  }
  const { data } = await axios.post(
    URL.GET_AMS_TOKEN,
    querystring.stringify({
      client_id: process.env.OFFNET_CLIENT_ID,
      client_secret: process.env.OFFNET_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: process.env.OFFNET_CLIENT_SCOPE,
    }),
    {
      headers: headerList,
      httpsAgent: agent,
    }
  );
  debug('got client credentials %o', data);
  return data;
};

/**
 * Retrieves the address according to the given LPDS ID from ams_testdata.
 * For simulation and jest testing.
 * @path ams_testdata path (tests/ams_testdata).
 * @async
 * @function getAddressByLpdsIdFromDummyData
 * @param {number} lpdsId - The LPDS ID.
 * @return [addresses].
 */
const getAddressByLpdsIdFromDummyData = async (lpdsid) => {
  const dummyDataPath = `${__dirname}/../tests/ams_testdata/ams_dummy.json`;
  const amsDummyData = fs.readFileSync(dummyDataPath);
  const jsonData = JSON.parse(amsDummyData);
  const addresses = jsonData.filter((data) => {
    return data.Addresses[0].referenceIds.LPDS_ID === lpdsid.toString();
  });
  return addresses[0];
};

/**
 * Retrieves the address according to the given LPDS ID.
 * @async
 * @function getAddressByLpdsId
 * @param {number} lpdsId - The LPDS ID.
 * @return {Promise<Object>} The response from AMS API.
 */
const getAddressByLpdsId = async (lpdsId) => {
  // Using mock data if not in production environment
  debug('Env status....', process.env.NODE_ENV);
  if (process.env.NODE_ENV !== 'production') {
    debug(
      `Current env is not in production. Caliing getAddressByLpdsIdFromDummyData instead.`
    );
    return getAddressByLpdsIdFromDummyData(lpdsId);
  }

  const {
    access_token: accessToken,
    token_type: tokenType,
  } = await getClientCredentials();

  let headerList = { Authorization: `${tokenType} ${accessToken}` };
  if (process.env.AMS_ENV) {
    headerList.env = process.env.AMS_ENV;
  }
  
  const { data } = await axios.get(
    `${URL.GET_ADDRESS_BY_ID}/${lpdsId}?id_type=LPDS`,
    {
      headers: headerList,
      httpsAgent: agent,
    }
  );
  debug('got response %o', data);
  return data;
};

export default {
  getAddressByLpdsId,
  getAddressByLpdsIdFromDummyData,
};
