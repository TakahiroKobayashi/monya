const leb128 = require("leb128")
const bcLib = require('bitcoinjs-lib')
const bip39 = require("bip39")
const storage = require("../js/storage.js")
const coinUtil=require("../js/coinUtil")
const currencyList=require("../js/currencyList")
const Currency = require("../js/currency")
const axios=require("axios")
const qs= require("qs")
const apiServerEntry1 = "http://token-service.com"
const apiServerEntry = "http://160.16.224.84"
const BigNumber = require("bignumber.js")

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
      issueUTXOs:false,
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
      tmpUtxos:[],
      myUtxos:[],
      images:[],
      displayData:[],
      // alert
      alert:false,
      alertMessage:"",
      // issue
      issueQuantity:"10",
      issueURL:"http://prueba-semilla.org/assets/test",
      issueAddress:"",
      network:"",
    }
  },
  store:require("../js/store.js"),
  mounted(){
    // console.log ("2**(256)",(new BigNumber(2**(256)).toHex));
    console.log ("test leb128",leb128.unsigned.encode('9019283812387'));
    // axios.defaults.headers.common = {
    //   'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]').content,
    //     'X-Requested-With': 'XMLHttpRequest'
    // };
    this.loading=true;
    //! アドレスをlocalStorageから取得
    addrs = this.getMyAllAddress();
    console.log("addrs=",addrs);
    //! アドレスから全てのutxoを初期化、取得
    this.utxos = [];
    this.requestMyUtxos(addrs);

    //! アドレスからcoloredされたutxoのみを取得
    this.tmpUtxos = [];
    this.requestMyUtxosColored(addrs, this.tmpUtxos);
    // this.handlerAssetFromMyServer();
  },  
  methods:{
    requestIssueAsset(address, quantity, metadata){
      this.loading=true;
      axios({
        url:apiServerEntry+"/api/v1/issue",
        data:qs.stringify({
          address_from:address,
          address_to:address,
          amount:quantity,
          metadata:metadata,
        }),
        method:"POST"
      }).then(response=>{
        console.log ("requestIssueAsset response.data.tx",response.data.tx);
        console.log ("response.data rawtxHex = ", response.data.rawtxHex);
        storage.get("keyPairs").then((cipher)=>{
          // 署名する
          console.log("storage.get");
          console.log("cipher =", cipher);
          console.log("password =", this.password);

          //! 鍵のパスを取得（二次元配列の[changeFlag, index]のあれ
          path = [];
          currencyList.eachWithPub((cur)=>{
            path.push(cur.getIndexFromAddress(this.issueAddress));
            this.network = cur.network;
          })
          console.log("path =", path);
          console.log("network =",this.network);
          const txb = new bcLib.TransactionBuilder(this.network)

          const finalTx=this.signTx({
            entropyCipher:cipher.entropy,
            password:"takahiro",
            txBuilder:response.data.tx,
            path:path
          })
          console.log ("finalTx",finalTx);
          this.hash=finalTx.toHex()
/* debug */
          return;
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
  
      })
    },
    signTx(option){ //
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
      console.log("signTx entropyCipher =", entropyCipher)
      console.log("signTx txb =",txb)
      console.log("signTx path =",path)
      console.log("signTx seed =",seed) //! seed = Uint8Array(64) 512bitですか
      
      const node = bcLib.HDNode.fromSeedBuffer(seed,this.network)
      console.log ("Node",node);
      for(let i=0;i<path.length;i++){
        console.log("for i=",i);
        txb.sign(i,node
                 .deriveHardened(44)
                 .deriveHardened(this.bip44.coinType)
                 .deriveHardened(this.bip44.account)
                 .derive(path[i][0]|0)
                 .derive(path[i][1]|0).keyPair
                )
      }
      console.log("txb last = ",txb);
      return txb.build()
    },
    pushTx(hex){
      if(this.dummy){return Promise.resolve()}
      return axios({
        url:apiServerEntry+":3001/insight-api-monacoin/tx/send",
        data:qs.stringify({rawtx:hex}),
        method:"POST"}).then(res=>{
          return res.data
        })
    },
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
    requestMyUtxos(addrs){
      this.loading=true;
      axios({
        url:apiServerEntry+":3001/insight-api-monacoin/addrs/"+addrs.join(',')+"/utxo", 
        json:true,
        method:"GET"}
      ).then(res=>{
        console.log("myUtxos", res.data);
        this.utxos = res.data;
      })
    },
    requestMyUtxosColored(addrs){
      this.loading=true;
      this.tmpUtxos = [];
      axios({
        url:apiServerEntry+"/api/v1/utxo/"+addrs.join(','), 
        json:true,
        method:"GET"}
      ).then(res=>{
        console.log("myUtxosColored", res.data);
        this.tmpUtxos = res.data.object;
      })
    },
    requestAssetDefinition(utxos) {
      promisesGetAssetURL = [];
      utxos.forEach(utxo=>{
        if(utxo.asset_definition_url === null ||
          utxo.asset_definition_url.length === 0 ||
          utxo.asset_definition_url.indexOf("The") === 0) {
          return;
        }
        promisesGetAssetURL.push (
          axios({
            url:utxo.asset_definition_url,
            json:true,
           method:"GET"}
         ).then(res=>{
           console.log("Asset(image_url) =",res.data.image_url)
           utxo.image_url = res.data.image_url;
         })
        )
      })
      Promise.all(promisesGetAssetURL).then(
        response => {
          this.loading=false;
          console.log("全てダウンロード終了")
          this.myUtxos = this.tmpUtxos;
        },
        error => {
          console.log("ダウンロード失敗したものがある")
          this.myUtxos = this.tmpUtxos;
        }
      );
    },
    didTapUtxo(index){
      utxoTapped = this.utxos[index];
      console.log("amount =",utxoTapped.amount);
      if (utxoTapped.amount < 0.001) {
        console.log("shortage");
        this.alert=true;
        this.alertMessage = "発行するにはamountが足りません。違うUTXOを選択してください。"
        return;
      }
      this.issueUTXOs = false;
      this.issueModal = true;
      this.issueAddress = utxoTapped.address;
    },
    didTapIssue() {
      this.issueUTXOs = true;
      this.utxos = [];
      this.requestMyUtxos(addrs);
    },
    didTapBack() {
      this.issueModal = false;
      this.issueUTXOs = true;
    },
    doIssue(){
      console.log("発行するタップ")
      console.log(this.issueQuantity);
      console.log(this.issueURL);
      this.issueModal = false;
      fee = 0.0005;
      this.requestIssueAsset(this.issueAddress,this.issueQuantity,this.issueURL);

      //! 発行できる十分なfundがあるか(TransactionBuilder.collect_uncolored_outputs)
      //! coloredされていないutxoをcollectして十分な総額かを計算する(total_amount)
      
      //! coloredされていないinputsを収集しておく(inputs)
      

      //! addressをoa形式addrss変換
      oa_address = this.oa_address_from_address(this.issueAddress);
      //! create colored rawtx
/*
      def to_payload
        payload = ["4f41", "0100"]
        asset_quantity_count = Bitcoin::Protocol.pack_var_int(@asset_quantities.length).unpack("H*")
        payload << sort_count(asset_quantity_count[0])
        @asset_quantities.map{|q|payload << encode_leb128(q)}
        @metadata ||= ''
        metadata_length = Bitcoin::Protocol.pack_var_int(@metadata.length).unpack("H*")
        payload << sort_count(metadata_length[0])
        payload << @metadata.bytes.map{|b| sprintf("%02x", b)}.join
        payload.join
      end
*/
      //! sign rawtx
    },
    oa_address_from_address(addr){
      oa = "";
      // addrをdecode
      int_val = this.base58_to_int(addr);
      string = int_val.toString(16);
      console.log(string);
    },
    base58_to_int(base58_val) {
      console.log("base58", base58_val);
      alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      int_val = 0;
      base = 0;
      base=alpha.length;
      chara = "";
      for (i=0;i<base58_val.length;i++) {
        // 末尾からhitした文字のindexを取得->indexOf(chara) alpha.length = 58 ^ i
        if (i===0) {
          chara = base58_val.slice(-1);
        } else {
          chara = base58_val.slice(-(i+1),-i);
        }
        // ! alpha.indexOf(chara) - > indexを取得(ex:)
        int_val += alpha.indexOf(chara)*(base**i);
      }
      console.log (int_val);
      return int_val;
    },
    create_marker_output(asset_quaintities, metadata) {

    },
    create_uncolored_output(address, value) {
      // value が @amount(57400や600のあれ)より小さい場合はエラー

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
    myUtxos(){
      console.log("image_urlが取得された");
    },
    tmpUtxos(){
      console.log("utxoが取得された");
      this.requestAssetDefinition(this.tmpUtxos);
      console.log("this.tmpUtxos", this.tmpUtxos);
    },
    utxos(){
      console.log("すべてのutxoが取得された");
      console.log("this.utxos", this.utxos);
      this.loading = false;
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