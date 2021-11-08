class AddressStringBuilder {

    constructor() {
        this._fullAddress = [];
        this._primaryValue = '';
        this._address = {};
    }

    // name of the property
    // this will build the 'address' object independently
    setName(propertyName) {
        this._propertyName = propertyName;
        this._address[this._propertyName];
        return this;
    }

    // primary value of the property
    setValue(primaryValue) {
        this._primaryValue = primaryValue;
        this._address[this._propertyName] = this._primaryValue;
        this._fullAddress.push(this._primaryValue);
        return this;
    }

    // alternative value if primary value is invalid(null, undefined)
    setAlternativeValue(alternativeValue) {
        if (!this._primaryValue) {
            this._alternativeValue = alternativeValue;
            this._fullAddress.pop();
            this._address[this._propertyName] = alternativeValue;
            this._fullAddress.push(alternativeValue);
        }

        return this;
    }

    // if primary and alternate value is invalid
    // this should only be preceeded by setAlternativeValue
    orElse(value) {
        if (!this._primaryValue && !this._alternativeValue) {
            this._fullAddress.pop();
            this._address[this._propertyName] = value;
            this._fullAddress.push(value);
        }

        return this;
    }

    // if primaryValue = valueToCompare
    // comparing primary value to be replaced with newValue
    replaceIf(valueToCompare, newValue) {
        if(this._primaryValue.toUpperCase() === valueToCompare.toString().toUpperCase()) {
            this._fullAddress.pop();
            this._fullAddress.push(newValue);
            this._address[this._propertyName] = newValue;
        }
        return this;
    }

    // completed address
    getAddress() {
        return this._address;
    }
    
    // build full address
    build() {
        const cleanFullAddress = this._fullAddress.filter(Boolean);
        return cleanFullAddress.join(" ");
    }
}

export default AddressStringBuilder;