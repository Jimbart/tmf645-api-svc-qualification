/* eslint-disable class-methods-use-this, no-empty, no-param-reassign, no-prototype-builtins, no-shadow, no-underscore-dangle */
import xml2js from 'xml2js';
import logger from '../logger';

class PayloadConverter {
  parseToJson(xmlPayload) {
    let data;

    xml2js.parseString(xmlPayload, { trim: true }, (error, result) => {
      if (error) {
        logger.error(error);
        return;
      }
      try {
        data = result;
      } catch (error) {
        logger.error(error.message);
      }
    });

    return data;
  }

  parseToXml(jsonPayload) {
    return new xml2js.Builder().buildObject(JSON.parse(jsonPayload));
  }

  // void
  // sets value to object from outside call.
  // no object cloned in the process.
  setJsonObjectValue(obj, property, replacer) {
    if (obj instanceof Array) {
      obj.forEach((innerObj) => {
        if (!(innerObj instanceof Object)) {
          return;
        }
        Object.keys(innerObj).forEach((key) => {
          if (innerObj.hasOwnProperty(property)) {
            innerObj[property] = [...replacer];
            return;
          }
          this.setJsonObjectValue(innerObj[key], property, replacer);
        });
      });
    } else if (obj instanceof Object) {
      Object.keys(obj).forEach((key) => {
        if (obj.hasOwnProperty(property)) {
          obj[property] = [...replacer];
          return;
        }
        this.setJsonObjectValue(obj[key], property, replacer);
      });
    } else {
    }
  }
}

export default PayloadConverter;
