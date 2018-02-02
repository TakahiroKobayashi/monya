const coinUtil=require("../js/coinUtil")
const currencyList=require("../js/currencyList")
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
      advanced:false,
      label:"",
      messageToShow:"aaa",
      txLabel:"",
      verifyResult:true,
      signature:false,
      utxoStr:"",
      urlAsset:"http://160.16.224.84/image/neko1.jpg",

      curs:[],
      fiatConv:0,
      fiat:this.$store.state.fiat,
      loading:false,
      state:"initial",
      error:false
      
    }
  },
  store:require("../js/store.js"),
  methods:{
    showlistUrlImage(){
      return ""
    },
    getAssetDefinition(){
      this.httpRequestAsset("xxx");
    },
        // assetIDを元にURLリクエストを行いjsonを取得する
    httpRequestAsset(assetId){
      xhr = new XMLHttpRequest();
      if (assetId == "xxx") {
        // create Request
        url = "http://160.16.224.84:3000";
      }
      // url open
      xhr.open("GET", url);
      xhr.addEventListener("load", (event) => {
        console.log("addEventListener")
        console.log(event.target.status); // => 200
        console.log(event.target.responseText); // => "{...}"
        json =  JSON.parse(event.target.responseText);
        console.log(json.image_url);
        this.urlAsset=json.image_url;
        return;
      });
      xhr.addEventListener("error", () => {
        console.log("Shit!! Network Error");
      });
      // send
      xhr.send(null);
    },
    getMyUtxo(){
      this.httpRequestUtxo("xxx");
    },
    httpRequestUtxo(done){
      this.curs=[]
      this.fiatConv=0
      this.loading=true;
      this.error=false
      let timer=setTimeout(()=>{
        this.loading=false
      },10000)
      const promises=[]
      currencyList.eachWithPub(cur=>{
        let obj={
          coinId:cur.coinId,
          balance:0,
          unconfirmed:0,
          screenName:cur.coinScreenName,
          price:0,
          icon:cur.icon
        }
        
        promises.push(cur.getWholeBalanceOfThisAccount()
          .then(res=>{
            console.log("sono1");
            obj.balance=res.balance
            obj.unconfirmed=res.unconfirmed
            this.curs.push(obj)
            return coinUtil.getPrice(cur.coinId,this.$store.state.fiat)
          }).then(res=>{
            console.log("sono2");
            this.fiatConv += res*obj.balance
            obj.price=res
            return obj
          }).catch(()=>{
            console.log("sono3");
            this.error=true
            obj.screenName=""
            return obj
          }))
      })
      Promise.all(promises).then(data=>{
        this.curs=data
        this.loading=false
        clearTimeout(timer)
        typeof(done)==='function'&&done()
      })
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
  watch:{
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
  mounted(){
    const url=this.$store.state.sendUrl
    if(url){
      this.$nextTick(()=>{
        this.address=url
      })
      this.$store.commit("setSendUrl")
    }
  }
})
