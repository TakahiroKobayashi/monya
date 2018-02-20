const coinUtil=require("../js/coinUtil")
const currencyList=require("../js/currencyList")
const axios=require("axios")
const apiServerEntry = "http://prueba-semilla.org"
module.exports=require("./openassetsIssue.html")({
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
      arrayDefinitionUrl:[],
      arrayAssetDefinition:[],
      opas:[{image_url:apiServerEntry+":88/image/inu1.jpg"},{image_url:apiServerEntry+":88/image/inu1.jpg"}],
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
        url = apiServerEntry+"assets/inu1.jpg";
      }
      // url open
      xhr.open("GET", url);
      xhr.addEventListener("load", (event) => {
        console.log("httpRequestAsset handler")
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
    // "get all my UTXOをタップ時"
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
        // address 取得
        addressList = [];
        const addressReceive = cur.getReceiveAddr();
        const addressChange = cur.getChangeAddr();
        for(let i=0; i<addressReceive.length;i++) {
          addressList.push(addressReceive[i]);
        }
        for(let i=0; i<addressChange.length;i++) {
          addressList.push(addressChange[i]);
        }

        console.log("addressList = ", addressList)

        // getUtxoを直接呼ぶ
        cur.getUtxos(addressList, true).then(res=>{
          console.log("in getUtxos.then, res.utxos = %s", JSON.stringify(res.utxos));
          // txidを元にMarker Outputを探すために全情報を取得する
          txidList = [];
          let utxoList = res.utxos
          for (let i=0; i<utxoList.length; i++) {
            console.log(utxoList[i])
            txidList.push(utxoList[i].txId)
          }
          console.log("txidList = ", txidList)
          
          // txidが取れたならまた非同期でtxidによる全ての情報を取得（自分のvoutのみならず）
          txList = [];
          for(let i=0; i<txidList.length; i++) {
            // getTxはinsight-apiを呼ぶ
            // なんこtxあって、終わるのがいつかわからんからぐるぐる出しとく？
            cur.getTx(txidList[i]).then(res=>{
              txList.push(res)
              console.log("tx%d",i, "=", res)
              //! markerOutputをvoutから探す
              res.vout.forEach(vout => {
                console.log(vout)
                // OP_RETURN
                if(vout.scriptPubKey.hex.substr(0,2)!=="6a") {
                  console.log(" not openassets marker ");
                  return;
                }
                // OAPマーカー
                if(!(vout.scriptPubKey.hex.substr(4,8)!=="4f41")) {
                  console.log(" not openassets marker ");
                  return;
                }

                console.log("!! detect openassets marker ")
                let pSize = vout.scriptPubKey.hex.substr(2,4)
                // version
              });
              
            })
          }
        })
      })
      // Promiseの全て終わった時のコールバックらしい,対象objectはpromises
      Promise.all(promises).then(data=>{
        console.log("Promise.all")
        this.curs=data
        this.loading=false
        clearTimeout(timer)
        typeof(done)==='function'&&done()
      })
    },
    // 自分のサーバでOAPマーカー検索処理を任せるため
    handlerAssetFromMyServer() {
      this.loading=true;

      let timer=setTimeout(()=>{
        this.loading=false
      },10000)
      const promisesGetAssets=[]
      // アドレス取得
      currencyList.eachWithPub(cur=>{

        // address 取得
        addressList = [];
        const addressReceive = cur.getReceiveAddr();
        const addressChange = cur.getChangeAddr();
        for(let i=0; i<addressReceive.length;i++) {
          addressList.push(addressReceive[i]);
        }
        for(let i=0; i<addressChange.length;i++) {
          addressList.push(addressChange[i]);
        }

        console.log("addressList = ", addressList)
      })
      // サーバリクエスト,レスポンス
      promisesGetAssets.push(
        // 自分の複数のアドレスからcoloredされたutxoのみを取得するapi
        axios({
        url:apiServerEntry+"/api/v1/openassets/addrs/"+addressList.join(','),
        json:true,
        method:"GET"}).then(res=>{
          
          arrayDefinitionUrl = []; // init
          console.log(res.data);
          result = res.data.object;
          result.forEach(utxo=>{
            if (utxo.asset_definition_url.indexOf("The asset definition is invalid.") !== 0) {
              arrayDefinitionUrl.push(utxo.asset_definition_url);
            }
          })
          console.log("urlADF=",arrayDefinitionUrl);
        })
      )

      Promise.all(promisesGetAssets).then(res=>{
        // 次はdefinition_urlからAssetDefinitionPointerの取得
        promisesGetAssetURL=[];

        // for demo
        //if (arrayDefinitionUrl.length == 0) {
        if (0) {
            arrayDefinitionUrl = [apiServerEntry+"/assets/test1",apiServerEntry+"/assets/test2"];
        }

// type hash160(21byte)
/*        arrayHashPointer = ["hSKATESKATESKATESKATE","hGRINDGRINDGRINDGRIND","hBOOSTBOOSTBOOSTBOOST","dDEBUGDEBUGDEBUGDEBUG"];

        // GET AssetDefinitionFile
        getAssetsInfoEndpoint = apiServerEntry+"/api/v1/openassets/pointer/hash/";
        
        let hashes='';
        arrayHashPointer.forEach(hash=>{
          if (hash.indexOf('h') === 0) {
            hashes = hashes+hash.slice(1)+',';
          }
        })
        // 最後の","を削除
        if (hashes.length !== 0 && hashes.lastIndexOf(',')+1 === hashes.length) {
          console.log("deta =",hashes);
          hashes = hashes.slice(0,-1); 
        }
        console.log(hashes);

        urlGetAssetInfo = getAssetsInfoEndpoint+hashes;
*/
        this.opas = [];
        arrayDefinitionUrl.forEach(definition_url=>{
          // init
//          _url = definition_url.slice(2); // slice "u=" 
          _url = definition_url; // 上の処理は不要、openassets-rubyに関して言えばu=は削除されて戻ってくる

          promisesGetAssetURL.push(
            axios({
            url:_url,
            json:true,
            method:"GET"}).then(res=>{
             // this.urlAsset = res.data.image_url
              this.opas.push(res.data)
            })
          )
        })

        // count
        console.log("promisesGetAssetURL count =", promisesGetAssetURL.length);

        Promise.all(promisesGetAssetURL).then(
          response => {
            console.log("全てダウンロード終了")
            this.opas.forEach(o=>{
              console.log(o);
            })
          },
          error => {
            console.log("ダウンロード失敗したものがある")
          }
        );
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
