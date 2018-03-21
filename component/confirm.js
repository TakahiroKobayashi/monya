const storage = require("../js/storage.js")
const coinUtil=require("../js/coinUtil")
const currencyList = require("../js/currencyList")
const bcLib = require('bitcoinjs-lib')
const errors = require("../js/errors")
const BigNumber = require('bignumber.js');
module.exports=require("./confirm.html")({
  data(){
    return {
      address:"",
      amount:"",
      fiat:"",
      feePerByte:0,
      fee:0,
      destHasUsed:false,
      message:"",
      myBalanceBeforeSending:0,
      showDetail:false,
      utxosToShow:null,
      signedHex:null,
      isEasy:false,
      coinType:"",
      utxoStr:"",
      ready:false,
      txb:null,
      addressPath:null,
      password:"",
      cur:null,
      insufficientFund:false,
      loading:true,
      incorrect:false,
      paySound:false,
      hash:""
    }
  },
  store:require("../js/store.js"),
  mounted(){
    ["address","amount","fiat","feePerByte","message","coinType","txLabel","utxoStr"].forEach(v=>{
      this[v]=this.$store.state.confPayload[v]
    })
    this.cur=currencyList.get(this.coinType)
    this.$nextTick(this.build)
    currencyList.get(this.coinType).getAddressProp("totalReceived",this.address).then(res=>{
      if(res|0){
        this.destHasUsed=true
      }
    })
    storage.verifyBiometric().then(pwd=>{
      this.password=pwd
    }).catch(()=>{
      // noop
    })
  },
  computed:{
    afterSent(){
      return (this.myBalanceBeforeSending-this.amount-this.fee)
    },
    utxosJson(){
      return JSON.stringify(this.utxosToShow)
    },
    build(){
      console.log("build passed")
      const cur =this.cur
      const targets = [{
        address:this.address,
        value:(new BigNumber(this.amount)).times(100000000).round().toNumber()
      }];
      if(this.message){
        targets.push({
          address:bcLib.script.nullData.output.encode(Buffer.from(this.message, 'utf8')),
          value:0
        })
      }
      storage.get("settings").then((data)=>{
        console.log("storage.get data = %d", data)
        this.paySound=data.paySound
        return cur.buildTransaction({
          targets,
          feeRate:this.feePerByte,
          includeUnconfirmedFunds:data.includeUnconfirmedFunds, // settingsから未認証のfundsを含めるかflag
          utxoStr:this.utxoStr
        })
      }).then(d=>{
        console.log("cur.buildTransactin = ",d);
        this.fee=(new BigNumber(d.fee)).divToInt(100000000)
        this.utxosToShow=d.utxos
        console.log("d.utxos =", d.utxos)
        this.path=d.path
        console.log("d.path =",d.path);
        this.myBalanceBeforeSending=d.balance
        this.txb=d.txBuilder
        this.ready=true
        this.loading=false
        return coinUtil.getPrice(cur.coinId,this.$store.state.fiat)
      }).then(price=>{
        console.log("price = %s", price)
        this.price=price
      }).catch(e=>{
        this.ready=false
        this.loading=false
        if(e instanceof errors.NoSolutionError){
          this.insufficientFund=true
        }else{
          this.$store.commit("setError",e.message)
        }
      })
    }
  },
  methods:{
    next(){
      this.loading=true
      const cur=this.cur
      if (cur.sound&&this.paySound) {
        (new Audio(cur.sound)).play()
      }
      
      console.log("送金ボタン");
      this.ready=false
      storage.get("keyPairs").then((cipher)=>{
        // 署名する
        console.log("storage.get");
        console.log("cipher =", cipher);
        console.log("password =", this.password);
        console.log("this.path =", this.path);
        const finalTx=cur.signTx({
          entropyCipher:cipher.entropy,
          password:this.password,
          txBuilder:this.txb,
          path:this.path
        })
        console.log("finaleTx=",finalTx);
        this.hash=finalTx.toHex()
        return; // テストデータ作成のため送信はしない
        return cur.pushTx(this.hash)
      }).then((res)=>{
        cur.saveTxLabel(res.txid,{label:this.txLabel,price:parseFloat(this.price)})
        this.$store.commit("setFinishNextPage",{page:require("./home.js"),infoId:"sent",payload:{
          txId:res.txid
        }})
        this.$emit("replace",require("./finished.js"))

        
      }).catch(e=>{
        this.loading=false
        if(e.request){
          this.$store.commit("setError",e.request.responseText||"Network Error.Please try again")
          
        }else{
          this.incorrect=true
          this.ready=true
          setTimeout(()=>{
            this.incorrect=false
          },3000)
        }
      })
    }
  }
})