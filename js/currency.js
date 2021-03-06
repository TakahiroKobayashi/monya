const bcLib = require('bitcoinjs-lib')
const axios = require('axios');
const BigNumber = require('bignumber.js');
const coinSelect = require('coinselect')
const bcMsg = require('bitcoinjs-message')
const bip39 = require("bip39")
const qs= require("qs")
const errors = require("./errors")
const coinUtil = require("./coinUtil")
const storage = require("./storage")
module.exports=class{
  
  constructor(opt){
    this.coinId = opt.coinId;
    this.coinScreenName = opt.coinScreenName;
    this.unit = opt.unit;
    this.unitEasy = opt.unitEasy;
    this.bip44 = opt.bip44;
    this.apiEndpoints=opt.apiEndpoints||[opt.defaultAPIEndpoint]
    this.apiEndpoint = opt.defaultAPIEndpoint||this.apiEndpoints[0];
    this.network = opt.network;
    this.price = opt.price;
    this.dummy=!!opt.dummy
    this.icon = opt.icon;
    this.bip21=opt.bip21;
    this.defaultFeeSatPerByte = opt.defaultFeeSatPerByte;
    this.confirmations=opt.confirmations||6
    this.sound=opt.sound||""
    this.counterpartyEndpoint=opt.counterpartyEndpoint
    this.enableSegwit=opt.enableSegwit
    
    this.hdPubNode=null;
    this.lastPriceTime=0;
    this.priceCache=0;
    this.changeIndex=-1;
    this.changeBalance=0;
    this.addresses={}
  }
  setPubSeedB58(seed){
    if(this.dummy){return}
    this.hdPubNode = bcLib.HDNode.fromBase58(seed,this.network)
  }
  pregenerateAddress(){
    this.getReceiveAddr()
    this.getChangeAddr()
  }
  getAddressProp(propName,address){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/addr/"+address+(propName?"/"+propName:""),
      json:true,
      method:"GET"}).then(res=>{
        return res.data
      })
  }
  getReceiveAddr(limit){
    if(!limit){
      limit=coinUtil.GAP_LIMIT
    }
    const adrss=[]
    for(let i=0;i<=limit;i++){
      adrss.push(this.getAddress(0,i))
    }
    return adrss
  }
  getChangeAddr(limit){
    if(!limit){
      limit=coinUtil.GAP_LIMIT_FOR_CHANGE
    }
    const adrss=[]
    for(let i=0;i<=limit;i++){
      adrss.push(this.getAddress(1,i))
    }
    return adrss
  }
  getIndexFromAddress(addr){
    for(let p in this.addresses){
      if(this.addresses[p]===addr){
        return p.split(",")
      }
    }
    return false
  }
  getReceiveBalance(includeUnconfirmedFunds){
    console.log("getReceiveBalance")
    return this.getUtxos(this.getReceiveAddr(),includeUnconfirmedFunds)
  }
  getChangeBalance(includeUnconfirmedFunds){
    console.log("getChangeBalance");
    return this.getUtxos(this.getChangeAddr(),includeUnconfirmedFunds).then(d=>{
      let newestCnf=Infinity
      let newestAddr=""
      let bal=new BigNumber(0)
      let unconfirmed=new BigNumber(0)
      const res=d.utxos

      console.log("d.utxos=", res);
      
      for(let i=0;i<res.length;i++){
        if(res[i].confirmations<newestCnf){
          newestCnf=res[i].confirmations
          newestAddr=res[i].address
        }
        if(res[i].confirmations===0){
          unconfirmed=unconfirmed.plus(res[i].value)
        }else{
          bal=bal.plus(res[i].value)
        }
      }
      this.changeIndex=newestAddr?
        this.getIndexFromAddress(newestAddr)[1]%coinUtil.GAP_LIMIT_FOR_CHANGE
      :-1
      console.log("bal=",bal);
      return {
        balance:bal,
        unconfirmed 
      }
    })
  }
  
  getWholeBalanceOfThisAccount(){
    console.log("currency getWholeBalanceOfThisAccount");
    if(this.dummy){return Promise.resolve()}
    return Promise.all([this.getReceiveBalance(false),this.getChangeBalance(false)]).then(vals=>({
      balance:vals[0].balance+vals[1].balance/100000000,
      unconfirmed:vals[0].unconfirmed+vals[1].unconfirmed/100000000
    }))
  }
  
  getUtxos(addressList,includeUnconfirmedFunds=false){
    console.log("in getUtxos addressList = ", addressList)
    let promise
    if(typeof(addressList[0])==="string"){//address mode
      console.log("address mode")
      promise=axios({
        url:this.apiEndpoint+"/addrs/"+addressList.join(",")+"/utxo",
        json:true,
        method:"GET"})
    }else{// manual utxo mode
      console.log("manual utxo mode")
      promise=Promise.resolve({data:addressList})
    }
    
    return promise.then(res=>{
      const v=res.data
      console.log("res.data =",v);
      const utxos=[]
      let bal=0;
      let unconfirmed=0;
      for(let i=0;i<v.length;i++){
        bal+=v[i].amount
        const u=v[i]
        if(includeUnconfirmedFunds||u.confirmations){
          console.log("utxo,txid=%s",u.txid);
          utxos.push({
            value:(new BigNumber(u.amount)).times(100000000).round().toNumber(),
            txId:u.txid,
            vout:u.vout,
            address:u.address,
            confirmations:u.confirmations
          })
        }else{
          unconfirmed+=u.amount
        }
      }
      console.log("bal = %s, utxo =", bal, utxos);
      return {
        balance:bal,
        utxos,
        unconfirmed
      }
    })
  }
  
  getAddress(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new Error("HDNode isn't specified.")}
    
    if(typeof index !=="number"){
      throw new Error("Please specify index")
    }
    const addrKey = (change|0).toString()+","+(index|0).toString()
    if(this.addresses[addrKey]){
      return this.addresses[addrKey]
    }else{
      if(this.enableSegwit){
        return (this.addresses[addrKey]=this.getSegwitAddress(change,index))
      }
      return (this.addresses[addrKey]=this.hdPubNode.derive(change).derive(index).getAddress())
    }
  }
  getPubKey(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new Error("HDNode isn't specified.")}
    
    if(typeof index !=="number"){
      throw new Error("Please specify index")
    }
    return this.hdPubNode.derive(change).derive(index).keyPair.getPublicKeyBuffer().toString("hex")
  }
  getSegwitAddress(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new Error("HDNode isn't specified.")}

    if(typeof index !=="number"){
      index=this.receiveIndex
    }
    const keyPair=this.hdPubNode.derive(change).derive(index).keyPair
    const witnessPubKey = bcLib.script.witnessPubKeyHash.output.encode(bcLib.crypto.hash160(keyPair.getPublicKeyBuffer()))
    
    const address = bcLib.address.fromOutputScript(witnessPubKey,this.network)
    return address
  }
  seedToPubB58(privSeed){
    if(this.dummy){return}
    let node;
    if(typeof privSeed ==="string"){
      node = bcLib.HDNode.fromBase58(privSeed,this.network)
    }else{
      node = bcLib.HDNode.fromSeedBuffer(privSeed,this.network)
    }
    return node
      .deriveHardened(44)
      .deriveHardened(this.bip44.coinType)
      .deriveHardened(this.bip44.account)
      .neutered().toBase58()
  }
  seedToPrivB58(privSeed){
    if(this.dummy){return}
    let node;
    if(typeof privSeed ==="string"){
      node = bcLib.HDNode.fromBase58(privSeed,this.network)
    }else{
      node = bcLib.HDNode.fromSeedBuffer(privSeed,this.network)
    }
    return node.toBase58()
  }
  getPrice(){
    return new Promise((resolve, reject) => {
      if(!this.price){
        return resolve(0)
      }
      
      if(this.lastPriceTime+1000*60<Date.now()){
        axios({
          method:this.price.method||"get",
          url:this.price.url,
          responseType:this.price.json?"json":"text"
        }).then(res=>{
          let temp = res.data
          if(this.price.json){
            this.price.jsonPath.forEach(v=>{
              if(v<0){
                temp = temp[temp.length+v]
              }else{
                temp = temp[v]
              }
            })
          }
          this.priceCache=temp
          this.lastPriceTime=Date.now()
          resolve(temp)
        }).catch(reject)
      }else{
        resolve(this.priceCache)
      }
    });
  }
  // Transactionを作成します
  /*
          return cur.buildTransaction({
          targets,
          feeRate:this.feePerByte,
          includeUnconfirmedFunds:data.includeUnconfirmedFunds,
          utxoStr:this.utxoStr
        })
  */
  buildTransaction(option){
    if(this.dummy){return null;}
    if(!this.hdPubNode){throw new Error("HDNode isn't specified.");}
    return new Promise((resolve, reject) => {
      const targets = option.targets
      const feeRate = option.feeRate

      const txb = new bcLib.TransactionBuilder(this.network)
      console.log("this.network",this.network);
      console.log("txb ok", txb);
      let param
      if(option.utxoStr){
        param=JSON.parse(option.utxoStr)
        console.log("option.utxoSrt param = %s", param)
      }else{
        param=this.getReceiveAddr().concat(this.getChangeAddr())
        console.log("else this.getReceiveAddr().concat(this.getChangeAddr()) =", param)
      }
      
      this.getUtxos(param,option.includeUnconfirmedFunds).then(res=>{
        console.log("in getUtxos.then, res.utxos = %s", JSON.stringify(res.utxos));
        const path=[]
        console.log("res.utxos", res.utxos);
        console.log("send targets", targets);
        console.log("feeRate = ", feeRate);
        //! 手持ちのutxoから送金に必要なutxoを簡単に作ってくれるライブラリ？
        const { inputs, outputs, fee } = coinSelect(res.utxos, targets, feeRate)

        console.log("inputs =", inputs)
        console.log("outputs =", outputs)
        
        if (!inputs || !outputs) throw new errors.NoSolutionError()
        // vin の作成
        inputs.forEach(input => {
          txb.addInput(input.txId, input.vout)
          path.push(this.getIndexFromAddress(input.address))
          
        })
        // vout の作成（自分へのお釣りも）
        outputs.forEach(output => {
          if (!output.address) {
            output.address = this.getAddress(1,(this.changeIndex+1)%coinUtil.GAP_LIMIT_FOR_CHANGE)
          }
          txb.addOutput(output.address, output.value)
        })
        
        resolve({txBuilder:txb,balance:res.balance,utxos:inputs,path,fee})
      }).catch(reject)
    })
  }
  signTx(option){
    const entropyCipher = option.entropyCipher
    const password= option.password
    let txb=option.txBuilder
    const path=option.path
    
    let seed=
        bip39.mnemonicToSeed(
          bip39.entropyToMnemonic(
            coinUtil.decrypt(entropyCipher,password)
          )
        )
    console.log("entropyCipher = %s", entropyCipher)
    console.log("txb = %s",txb)
    console.log("path = %s",path)
    console.log("seed = %s",seed) //! seed = Uint8Array(64) 512bitですか

    //! 
    const node = bcLib.HDNode.fromSeedBuffer(seed,this.network)
    console.log("node",node);

    if(!txb){
      txb=coinUtil.buildBuilderfromPubKeyTx(bcLib.Transaction.fromHex(option.hash),this.network)

      for(let i=0;i<txb.inputs.length;i++){
      txb.sign(i,node
               .deriveHardened(44)
               .deriveHardened(this.bip44.coinType)
               .deriveHardened(this.bip44.account)
               .derive(path[0][0]|0)
               .derive(path[0][1]|0).keyPair
              )
      }
      return txb.build()
    }
    
    for(let i=0;i<path.length;i++){
      console.log("for i",i);
      txb.sign(i,node
               .deriveHardened(44)
               .deriveHardened(this.bip44.coinType)
               .deriveHardened(this.bip44.account)
               .derive(path[i][0]|0)
               .derive(path[i][1]|0).keyPair
              )
    }
    console.log("txb last send",txb);
    return txb.build()
    
  }
  signMessage(m,entropyCipher,password,path){
    const kp=bcLib.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(
          bip39.entropyToMnemonic(
            coinUtil.decrypt(entropyCipher,password)
          )
        ),this.network)
               .deriveHardened(44)
               .deriveHardened(this.bip44.coinType)
               .deriveHardened(this.bip44.account)
               .derive(path[0]|0)
          .derive(path[1]|0).keyPair
    return bcMsg.sign(m,kp.d.toBuffer(32),kp.compressed,this.network.messagePrefix).toString("base64")
  }
  verifyMessage(m,a,s){
    return bcMsg.verify(m,a,s,this.network.messagePrefix)
  }
  pushTx(hex){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/tx/send",
      data:qs.stringify({rawtx:hex}),
      method:"POST"}).then(res=>{
        return res.data
      })
  }

  getTxs(from,to){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/addrs/txs",
      data:qs.stringify({
        noAsm:1,
        noScriptSig:1,
        noSpent:0,
        from,to,
        addrs:this.getReceiveAddr().concat(this.getChangeAddr()).join(",")
      }),
      method:"POST"}).then(res=>{
        return res.data
      })
  }
  
  getTx(txId){
    console.log("getTx called!!")
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/tx/"+txId,
      method:"GET"})
      .then(res=>{
        return res.data
      })
  }
  getTxLabel(txId){
    return storage.get("txLabels").then(res=>{
      if(res&&res[this.coinId]){
        if(txId){
          return res[this.coinId][txId]||{}
        }
        return res[this.coinId]
      }else{
        return {}
      }
    })
  }
  saveTxLabel(txId,payload){
    return storage.get("txLabels").then(res=>{
      if(!res){
        res={}
      }
      if(!res[this.coinId]){
        res[this.coinId]={}
      }
      const txs=res[this.coinId][txId]
      if(txs){
        payload.price&&(txs.price=payload.price)
        payload.label&&(txs.label=payload.label)
        payload.read&&(txs.read=true)
      }else{
        res[this.coinId][txId]={
          price:payload.price||0,
          label:payload.label||"",
          read:true
        }
      }
      return storage.set("txLabels",res)
    })
  }
  
  getLabels(){
    return storage.get("labels").then(res=>{
      if(res&&res[this.coinId]){
        return res[this.coinId]
      }else{
        return [coinUtil.DEFAULT_LABEL_NAME]
      }
    })
  }
  updateLabel(name,newName){
    return storage.get("labels").then(res=>{
      if(!res||!res[this.coinId]){
        throw new Error("Label object for this currency is not created yet.");
      }
      const index=res[this.coinId].indexOf(name)
      if(index>=0){
        res[this.coinId][index]=newName
        return storage.set("labels",res)
      }
      throw new errors.LabelNotFoundError()
    })
  }
  createLabel(name){
    return storage.get("labels").then(res=>{
      if(!res){
        res={}
      }
      if(!res[this.coinId]){
        res[this.coinId]=[coinUtil.DEFAULT_LABEL_NAME]
      }
      if(res[this.coinId].length>exports.GAP_LIMIT){
        throw new errors.TooManyLabelsError()
      }
      if(res[this.coinId].indexOf(name)<=0){
        res[this.coinId].push(name)
      }
      return storage.set("labels",res)
    })
  }

  callCP(method,params){
    return axios.post(this.counterpartyEndpoint,{
      params,
      id:0,
      jsonrpc:"2.0",
      method
    }).then(r=>{
      if(r.data.error&&r.data.error.code){
        throw r.data.error.data
      }
      return r.data.result
    })
  }
  callCPLib(method,params){
    return axios.post(this.counterpartyEndpoint,{
      params:{
        method,
        params
      },
      id:0,
      jsonrpc:"2.0",
      method:"proxy_to_counterpartyd"
    }).then(r=>{
      if(r.data.error&&r.data.error.code){
        throw r.data.error.data
      }
      return r.data.result
    })
  }
  sweep(priv,addr,fee){
    const keyPair=bcLib.ECPair.fromWIF(priv,this.network)
    return this.getUtxos([keyPair.getAddress()]).then(r=>{
      const txb = new bcLib.TransactionBuilder(this.network)
      r.utxos.forEach((v,i)=>{
        txb.addInput(v.txId,v.vout)
      })
      txb.addOutput(addr,(new BigNumber(r.balance)).minus(fee).times(100000000).toNumber())
      r.utxos.forEach((v,i)=>{
        txb.sign(i,keyPair)
      })
      
      return this.pushTx(txb.build().toHex())
    })
  }
  getBlocks(){
    return axios({
        url:this.apiEndpoint+"/blocks?limit=3",
        json:true,
      method:"GET"}).then(r=>r.data.blocks)
  }
  changeApiEndpoint(index){
    if (typeof(index)!=="number"){
      index=(this.apiEndpoints.indexOf(this.apiEndpoint)+1)%this.apiEndpoints.length
    }
    this.apiEndpoint = this.apiEndpoints[index]
  }
}
