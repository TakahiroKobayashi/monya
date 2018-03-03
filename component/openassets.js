const coinUtil=require("../js/coinUtil")
const currencyList=require("../js/currencyList")
const axios=require("axios")
const apiServerEntry1 = "http://token-service.com"
const apiServerEntry = "http://prueba-semilla.org"

module.exports=require("./openassets.html")({
  data(){
    return {
      address:"",
      amount:0,
      fiat:0,
      feePerByte:0,
      message:"",
      balance:0,
      price:1,
      coinType:"",
      possibility:[],
      fiatTicker:this.$store.state.fiat,
      issueModal:false,
      label:"",
      messageToShow:"aaa",
      txLabel:"",
      verifyResult:true,
      signature:false,
      utxoStr:"",
      urlAsset:apiServerEntry+":88/image/inu1.jpg",

      curs:[],
      fiatConv:0,
      fiat:this.$store.state.fiat,
      loading:false,
      state:"initial",
      error:false,
      // add
      addressList:[],
      txidList:[],
      txList:[],
      // arrayDefinitionUrl:[],
      arrayAssetDefinition:[],
//      opas:[{image_url:apiServerEntry+":88/image/inu1.jpg"},{image_url:apiServerEntry+":88/image/inu1.jpg"}],
      opas:[],
      utxos:[],
      coloredUtxos:[],
      images:[],
      displayData:[],
    }
  },
  store:require("../js/store.js"),
  mounted(){
    this.loading=true;
    addrs = this.getMyAllAddress();
    console.log("addrs=",addrs);
    utxos = [];
    this.requestMyUtxos(addrs, utxos);
    console.log("utxos=", utxos);
    this.coloredUtxos = [];
    this.requestMyUtxosColored(addrs, this.coloredUtxos);
    // this.handlerAssetFromMyServer();
  },  
  methods:{
    getMyAllAddress(curType){
      addressList = [];
      currencyList.eachWithPub(cur=>{
        const addressReceive = cur.getReceiveAddr();
        const addressChange = cur.getChangeAddr();
        for(let i=0; i<addressReceive.length;i++) {
          addressList.push(addressReceive[i]);
        }
        for(let i=0; i<addressChange.length;i++) {
          addressList.push(addressChange[i]);
        }
      })
      return addressList;
    },
    requestMyUtxos(addrs, uxtos){
      this.loading=true;
      axios({
        url:apiServerEntry+":3001/insight-api-monacoin/addrs/"+addrs.join(',')+"/utxo", 
        json:true,
        method:"GET"}
      ).then(res=>{
        // arrayDefinitionUrl = []; // init
        console.log("myUtxos", res.data);
        result = res.data;
        result.forEach(utxo => {
          utxos.push(utxo);
        });
      })
    },
    requestMyUtxosColored(addrs){
      this.loading=true;
      this.coloredUtxos = [];
      axios({
        url:apiServerEntry+"/api/v1/utxo/"+addrs.join(','), 
        json:true,
        method:"GET"}
      ).then(res=>{
        console.log("myUtxosColored", res.data);
        this.coloredUtxos = res.data.object;
      })
    },
    requestAssetDefinition(coloredUtxos) {
      promisesGetAssetURL = [];
      console.log(coloredUtxos);
      coloredUtxos.forEach(cUtxo=>{
        if(cUtxo.asset_definition_url.indexOf("The") === 0) {
          return;
        }
        promisesGetAssetURL.push (
          axios({
            url:cUtxo.asset_definition_url,
            json:true,
           method:"GET"}
         ).then(res=>{
           console.log("Asset(image_url) =",res.data.image_url)
           cUtxo.image_url = res.data.image_url;
         })
        )
      })
      Promise.all(promisesGetAssetURL).then(
        response => {
          this.loading=false;
          console.log("全てダウンロード終了")
          this.utxos = this.coloredUtxos;
        },
        error => {
          console.log("ダウンロード失敗したものがある")
        }
      );
    },
    doIssue(){
      this.issueModal = false;
      //! utxoをチョイス！
      srcUtxo;
      

      //! addressをoa形式addrss変換

      //! create colored rawtx

      //! sign rawtx
    },
    issue(){
      this.$emit("push",require("./openassetsIssue.js")) // 画面遷移
    },
     confirm(){
      if(!this.address||!this.coinType||isNaN(this.amount*1)||(this.amount*1)<=0||!this.feePerByte||!coinUtil.getAddrVersion(this.address)||(this.message&&Buffer.from(this.message, 'utf8').length>40)){
        
        this.$ons.notification.alert("正しく入力してね！")
        return;
      }
      this.$store.commit("setConfirmation",{
        address:this.address,
        amount:this.amount,
        fiat:this.fiat,
        feePerByte:this.feePerByte,
        message:this.message,
        coinType:this.coinType,
        txLabel:this.txLabel,
        utxoStr:this.utxoStr
      })
      this.$emit("push",require("./confirm.js"))
    },
    getPrice(){
      coinUtil.getPrice(this.coinType,this.fiatTicker).then(res=>{
        this.price=res
      })
    },
    calcFiat(){
     this.$nextTick(()=> this.fiat=Math.ceil(this.amount*this.price*10000000)/10000000)
    },
    calcCur(){
      this.$nextTick(()=>this.amount=Math.ceil(this.fiat/this.price*10000000)/10000000)
    },
    qr(){
      this.$emit("push",require("./qrcode.js"))
    }
  },
  watch:{ // kvo的な？
    displayData(){

    },
    coloredUtxos(){
      console.log("utxosColoredが取得された");
      this.requestAssetDefinition(this.coloredUtxos);
    },
    utxos(){
      console.log("image_urlが取得された");
    },
    address(){
      this.$set(this,"possibility",[])
      if(this.address){
        coinUtil.parseUrl(this.address).then(u=>{
          if(u.isCoinAddress&&u.isPrefixOk&&u.isValidAddress){
            const cur=currencyList.get(u.coinId)
            this.coinType=u.coinId
            this.possibility.push({
              name:cur.coinScreenName,
              coinId:u.coinId
            })
            this.signature=u.signature
            if(u.signature){
              this.verifyResult=cur.verifyMessage(u.message,u.address,u.signature)
            }
            this.address=u.address
            this.message=u.opReturn
            this.messageToShow=u.message
            this.amount=u.amount
            this.label=u.label
            this.utxoStr=u.utxo
            return
          }else{
            currencyList.eachWithPub((cur)=>{
              const ver = coinUtil.getAddrVersion(this.address)
              if(ver===cur.network.pubKeyHash||
                ver===cur.network.scriptHash){
                this.possibility.push({
                  name:cur.coinScreenName,
                  coinId:cur.coinId
                })
              }
            })
            if(this.possibility[0]){
              this.coinType=this.possibility[0].coinId
            }else{
              this.coinType=""
            }
          }
        })
      }else{
        this.coinType=""
      }
    },
    coinType(){
      if(this.coinType){
        this.getPrice()
        this.feePerByte = currencyList.get(this.coinType).defaultFeeSatPerByte
      }
    }
  },
  computed:{
    remainingBytes(){
      return 40-Buffer.from(this.message||"", 'utf8').length
    }
  },
})
