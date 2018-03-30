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
const coinSelect = require('coinselect')

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
      detailCardModal:false,
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
      loadingMessage:"",
      loadingCloseTitle:"閉じる",
      // issue
      utxoIssue:[],
      issueQuantity:"10",
      issueURL:"http://prueba-semilla.org/assets/test3",
      issueAddress:"",
      network:"",
      bip44:{},
      // detail
      detailUtxo:"",

      // upload
      iconImageFile:"",
      assetImageFile:"",
      preview:"",
      imageIconFile:[],
      uploadedImage: '',
      imagefile:'',
    }
  },
  store:require("../js/store.js"),
  mounted(){
    // axios.defaults.headers.common = {
    //   'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]').content,
    //     'X-Requested-With': 'XMLHttpRequest'
    // };
    //! アドレスをlocalStorageから取得
    addrs = this.getMyAllAddress();
    //! アドレスから全てのutxoを初期化、取得
    this.utxos = [];
    this.requestMyUtxos(addrs);

    //! アドレスからcoloredされたutxoのみを取得
    this.requestMyUtxosColored(addrs);
    // this.handlerAssetFromMyServer();
  },  
  methods:{
    onFileChange(e) {
      let files = e.target.files || e.dataTransfer.files;
      console.log("files", files);
      this.createImage(files[0]);
      this.imagefile = files[0];
    },
    // アップロードした画像を表示
    createImage(file) {
      let reader = new FileReader();
      reader.onload = (e) => {
        this.uploadedImage = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    didTapUploadButton() {
      const URL = 'http://prueba-semilla.org:4000/';
      // instance 初期化
      let data = new FormData();
      data.append('name', 'my-picture');
      data.append('file', this.imagefile); 
      let config = {
        header : {
          'Content-Type' : 'image/png'
        }
      }
      axios.post(
        URL, 
        data,
        config
      ).then(
        response => {
          console.log('image upload response > ', response)
        }
      )
    },
    requestGenerateSendAsset(asset_id, to_address, quantity, from_address) {
      console.log("asset_id", asset_id);
      console.log("to_address",to_address);
      console.log("quantity", quantity);
      console.log("from_address", from_address);


    },
    requestIssueAsset(address, quantity, metadata){
      this.loading=true;
      this.loadingMessage="発行中";
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
        console.log("response.api",response.data);
        vout = [];
        vout = response.data.tx.out;
        metadata = ""; // hex
        for (i=0;i<vout.length;i++) {
          tmpArraySeparated = vout[i].scriptPubKey.split(" ");
          if (tmpArraySeparated[0] === "OP_RETURN" && tmpArraySeparated.length === 2) {
            metadata = tmpArraySeparated[1];
            break;
          }
        }
        storage.get("keyPairs").then((cipher)=>{
          // 署名する

          //! 鍵のパスを取得（二次元配列の[changeFlag, index]のあれ
          //! アドレスパスの取得とネットワークの取得
          addressPath = [];
          currencyList.eachWithPub((cur)=>{
            addressPath.push(cur.getIndexFromAddress(address));
            this.network = cur.network;
            this.bip44.coinType = cur.bip44.coinType;
            console.log("this.bip44.coinType",this.bip44.coinType);
            console.log("typeof", typeof(cur.bip44.coinType));
            this.bip44.account = cur.bip44.account;
            console.log("this.bip44.account",this.bip44.account);
            console.log("typeof", typeof(cur.bip44.account));
          })

          const unsignedTx = this.buildTxIssue(
            [{
              address:this.utxoIssue.address,
              confirmations:this.utxoIssue.confirmations,
              vout:this.utxoIssue.vout,
              txId:this.utxoIssue.txid,
              value:this.utxoIssue.satoshis,
            }],
            vout,
            metadata,
            200
          );
          console.log ("unsignedTx", unsignedTx);
          const signedTx=this.signTx({
            entropyCipher:cipher.entropy,
            password:"takahiro",
            txBuilder:unsignedTx,
            path:addressPath
          })
          console.log ("signedTx",signedTx);
          this.hash=signedTx.toHex()
          console.log ("this.hash = ", this.hash);
/* debug */
          return this.pushTx(this.hash)
        }).then((res)=>{
          console.log("send signedTx done");
          console.log("res.data", res);
          this.loading = false;
          return;
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
    buildTxIssue(utxos,vout,metadata,feerate){
      const targets = [];
      targets.push({
        address:this.utxoIssue.address,
        value:Number(vout[0].value)*100000000
      });
      targets.push({
        address:bcLib.script.nullData.output.encode(Buffer(metadata,"hex")),
        value:Number(vout[1].value) // markeroutputなので0のはず
      });
      const { inputs, outputs, fee } = coinSelect(utxos, targets, feerate)

      if (!inputs || !outputs) throw new errors.NoSolutionError()

      const txb = new bcLib.TransactionBuilder(this.network);
      inputs.forEach(input => {
        txb.addInput(input.txId, input.vout)        
      })
      // vout の作成（自分へのお釣りも）
      outputs.forEach(output => {
        if (!output.address) {
          output.address = this.utxoIssue.address
        }
        txb.addOutput(output.address, output.value)
      })

      return txb;
    },
    signTx(option){ //
      this.loadingMessage="署名中";
      const entropyCipher = option.entropyCipher // 一緒
      const password= option.password
      let txb=option.txBuilder
      const path=option.path
      
      // seedの取得
      let seed=
          bip39.mnemonicToSeed(
            bip39.entropyToMnemonic(
              coinUtil.decrypt(entropyCipher,password)
            )
          )
      
      // tree structure of HDwallet key chain
      const node = bcLib.HDNode.fromSeedBuffer(seed,this.network)
      console.log ("Node",node);
      for(let i=0;i<path.length;i++){
        // m/44(purpose fixed)/
        txb.sign(i,node
                 .deriveHardened(44)
                 .deriveHardened(this.bip44.coinType) //bip44.coinType
                 .deriveHardened(this.bip44.account) //bip44.account
                 .derive(path[i][0]|0)
                 .derive(path[i][1]|0).keyPair
                )
      }
      console.log("txb last = ",txb);
      return txb.build() // bitcoin-js > transaction_builder.js > tx.setInputScript
    },
    pushTx(hex){
      this.loadingMessage="署名済みトランザクションを送信中";
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
        this.loading=false;
        this.utxos = res.data;
      })
    },
    requestMyUtxosColored(addrs){
      this.loading=true;
      this.loadingMessage="OpenAssets情報の取得中";
      if (addrs == null) {
        addrs = this.getMyAllAddress();
      }

      this.tmpUtxos = [];
      axios({
        url:apiServerEntry+"/api/v1/utxo/"+addrs.join(','), 
        json:true,
        method:"GET"}
      ).then(res=>{
        this.loading=false;
        this.tmpUtxos = res.data.object;
      })
    },
    requestAssetDefinition(utxos) {
      promisesGetAssetURL = [];
      utxos.forEach(utxo=>{
        if(utxo.asset_definition_url === null ||
          utxo.asset_definition_url.length === 0 ||
          utxo.asset_definition_url.indexOf("http") !== 0) {
          return;
        }
        console.log("asset definition request url", utxo.asset_definition_url);
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
          this.myUtxos = this.tmpUtxos;
        },
        error => {
          console.log("ダウンロード失敗したものがある")
          this.myUtxos = this.tmpUtxos;
        }
      );
    },
    didTapUtxo(index){
      this.utxoIssue = this.utxos[index];
      if (this.utxoIssue.amount < 0.001) {
        this.alert=true;
        this.alertMessage = "発行するにはamountが足りません。違うUTXOを選択してください。"
        return;
      }
      this.issueUTXOs = false;
      this.issueModal = true;
      this.issueAddress = this.utxoIssue.address;
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
    didTapCard(index) {
      console.log("didtapcard index=",index);
      this.confirmSend(index);
    },
    didTapBackToTop(){
      this.issueModal = false;
      this.detailCardModal = false;
    },
    confirmSend(index){
      this.detailUtxo = this.myUtxos[index];
      console.log("show detailCardModal");
      this.detailCardModal = true;
    },
    doIssue(){
      console.log("発行するタップ")
      this.issueModal = false;
      fee = 0.0005;
      promise = [];
      promise.push(
        this.requestIssueAsset(this.issueAddress,this.issueQuantity,this.issueURL)
      );
      Promise.all(promise).then(res=>
        {
          this.requestMyUtxosColored();
        }
      );
      //! 発行できる十分なfundがあるか(TransactionBuilder.collect_uncolored_outputs)
      //! coloredされていないutxoをcollectして十分な総額かを計算する(total_amount)
      
      //! coloredされていないinputsを収集しておく(inputs)
      

      //! addressをoa形式addrss変換
      // oa_address = this.oa_address_from_address(this.issueAddress);
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
      return int_val;
    },
    create_marker_output(asset_quaintities, metadata) {

    },
    create_uncolored_output(address, value) {
      // value が @amount(57400や600のあれ)より小さい場合はエラー

    },
  },
  watch:{ // kvo的な？
    displayData(){

    },
    myUtxos(){
      console.log("image_urlが取得された");
    },
    tmpUtxos(){
      this.requestAssetDefinition(this.tmpUtxos);
    },
    utxos(){
      this.loading = false;
    },
    coinType(){
      if(this.coinType){
        this.getPrice()
        this.feePerByte = currencyList.get(this.coinType).defaultFeeSatPerByte
      }
    },
    imageIconFile(){
      console.log("imageIconFile changed");
    }
  },
  computed:{
  },
})