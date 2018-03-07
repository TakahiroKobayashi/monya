const bcLib = require('bitcoinjs-lib')
const bip39 = require("bip39")
const storage = require("../js/storage.js")
const coinUtil = require("../js/coinUtil.js")
module.exports=require("./showPassphrase.html")({
  data(){
    return {
      keyArray:null,
      words:[],
      password:"",
      requirePassword:false,
      showNext:true,
      incorrect:false,
      data:null
    }
  },
  store:require("../js/store.js"),
  methods:{
    next(){
      this.$emit("push",require("./setPassword.js"))
    },
    render(entropy){
      console.log("render")
      this.words=bip39.entropyToMnemonic(entropy).split(" ");
      // koba test
      seed = bip39.mnemonicToSeed(bip39.entropyToMnemonic(entropy));
      node = bcLib.HDNode.fromSeedBuffer(seed);
      string = node.neutered().toBase58();
      console.log(string); // xpub
    },
    decrypt(){
      storage.get("keyPairs").then((cipher)=>{
        this.render(
          coinUtil.decrypt(cipher.entropy,this.password)
        )
        this.requirePassword=false
        this.password=""
      }).catch(()=>{
        this.incorrect=true
        setTimeout(()=>{
          this.incorrect=false
        },3000)
      })
    }
  },
  computed:{
    serializedData(){
      return JSON.stringify(this.data)
    }
  },
  mounted(){
    if(this.$store.state.entropy){
      this.render(this.$store.state.entropy)
    }else{
      this.requirePassword=true
      this.showNext=false
      Promise.all(["keyPairs","labels","txLabels","settings","customCoins","addresses","zaifPayInvoice"].map(v=>storage.get(v))).then(d=>{
        this.data=d
      })
    }
    
  }
})
