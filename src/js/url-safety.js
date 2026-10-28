/* Single website URL validation gate. No saved password or decrypted value is sent anywhere. */
(()=>{
  'use strict';
  function validate(value,{allowBareHost=false}={}){
    if(typeof value!=='string')throw new Error('Website URL must be text.');
    let source=value.trim();
    if(!source)return '';
    if(source.length>2048 || /[\x00-\x1f\x7f\\]/.test(source))throw new Error('Invalid website URL.');
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(source)){
      if(!allowBareHost || /^[a-z][a-z0-9+.-]*:/i.test(source) || /^\//.test(source))throw new Error('Website must use https:// or http://.');
      source='https://'+source;
    }
    let parsed;
    try{parsed=new URL(source);}catch{throw new Error('Website URL is not valid.');}
    if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password||parsed.origin==='null'){
      throw new Error('Website must be a valid http or https address without embedded credentials.');
    }
    return source;
  }
  function validateImportedVault(vault){
    if(!vault || !Array.isArray(vault.credentials))throw new Error('Invalid imported vault.');
    for(const record of vault.credentials){
      if(record && record.url)validate(record.url);
      if(record && Array.isArray(record.customFields))for(const field of record.customFields){
        if(field && field.type==='url' && field.value)validate(field.value);
      }
    }
    return true;
  }
  Object.defineProperty(window,'PassVaultURLSafety',{value:Object.freeze({validate,validateImportedVault}),writable:false,configurable:false});
})();
