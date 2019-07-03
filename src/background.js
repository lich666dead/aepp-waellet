import MemoryAccount from '@aeternity/aepp-sdk/es/account/memory'
import Account from '@aeternity/aepp-sdk/es/account'
// import ExtensionProvider from '@aeternity/aepp-sdk/es/provider/extension'
import { phishingCheckUrl, getPhishingUrls, setPhishingUrl } from './popup/utils/phishing-detect';

global.browser = require('webextension-polyfill');

// listen for our browerAction to be clicked
chrome.browserAction.onClicked.addListener(function (tab) {
    // for the current tab, inject the "inject.js" file & execute it
	chrome.tabs.executeScript(tab.id, {
        file: 'inject.js'
	});
});

setInterval(() => {
    chrome.windows.getAll({}, (wins) => {
        if(wins.length == 0) {
            sessionStorage.removeItem("phishing_urls");
        }
    });
},60000);

chrome.windows.onRemoved.addListener(function(windowid) {
    localStorage.removeItem("phishing_urls");
})
chrome.browserAction.setBadgeText({ 'text': 'beta' });
chrome.browserAction.setBadgeBackgroundColor({ color: "#FF004D"});

function getAccount() {
    return new Promise(resolve => {
        chrome.storage.sync.get('userAccount', data => {
            if (data.userAccount && data.userAccount.hasOwnProperty('publicKey')) {
                resolve({ keypair: {
                    publicKey: data.userAccount.publicKey,
                    secretKey: data.userAccount.secretKey
                }})
            }
        })
    });
}


// getAccount()
//     .then((account) => {
//         // Init accounts
//         const accounts = [
//             // You can add your own account implementation,
//             // Account.compose({
//             //     init() {
//             //     },
//             //     methods: {
//             //         /**
//             //          * Sign data blob
//             //          * @function sign
//             //          * @instance
//             //          * @abstract
//             //          * @category async
//             //          * @rtype (data: String) => data: Promise[String]
//             //          * @param {String} data - Data blob to sign
//             //          * @return {String} Signed data blob
//             //          */
//             //         async sign(data) {
//             //         },
//             //         /**
//             //          * Obtain account address
//             //          * @function address
//             //          * @instance
//             //          * @abstract
//             //          * @category async
//             //          * @rtype () => address: Promise[String]
//             //          * @return {String} Public account address
//             //          */
//             //         async address() {
//             //         }
//             //     }
//             // })(),
//             MemoryAccount(account)
//         ]
//         return accounts
//     })
//     .then((accounts) => {
//         // Init extension stamp from sdk
//         ExtensionProvider({
//             // Provide post function (default: window.postMessage)
//             postFunction: postToContent,
//             // By default `ExtesionProvider` use first account as default account. You can change active account using `selectAccount (address)` function
//             accounts: accounts,
//             // Hook for sdk registration
//             onSdkRegister: function (sdk) {
//                 // sendDataToPopup(this.getSdks())
//                 // if (confirm('Do you want to share wallet with sdk ' + sdk.sdkId)) sdk.shareWallet()
//                 sdk.shareWallet();
//                 chrome.storage.sync.set({showAeppPopup:{ data: sdk.sdkId.toString(), type:'confirm',callback:null } } , () => {
//                     chrome.windows.create({
//                         url: chrome.runtime.getURL('./popup/popup.html'),
//                         type: "popup",
//                         height: 600,
//                         width:420
//                       },() => {
//                         console.log("created");
                        
//                     });
//                 });
//             },
//             // Hook for signing transaction
//             onSign: function ({sdkId, tx, txObject, sign}) {
//                 // sendDataToPopup(this.getSdks())
//                 // if (confirm('Do you want to sign ' + JSON.stringify(txObject) + ' ?')) sign() // SIGN TX
//                 // sign();
//                 console.log(sign);
//                 chrome.storage.sync.set({showAeppPopup:{ data: txObject, type:'sign',callback:'asd'  } } , () => {
//                     chrome.windows.create({
//                         url: chrome.runtime.getURL('./popup/popup.html'),
//                         type: "popup",
//                         height: 600,
//                         width:420
//                       },() => {
//                         console.log("created");
//                     });
//                 });
//             }
//         }).then(provider => {
//             // Subscribe from postMessages from page
//             chrome.runtime.onMessage.addListener((msg, sender) => {
//                 switch (msg.method) {
//                     case 'pageMessage':
//                         console.log(msg);
//                         provider.processMessage(msg);
//                         break 
//                 }
//             })
//         }).catch(err => {
//             console.error(err)
//         })
//     });

chrome.runtime.onMessage.addListener((msg, sender) => {
    console.log(msg)
    switch(msg.method) {
        case 'phishingCheck':
            let data = {...msg};
            phishingCheckUrl(msg.data.hostname)
            .then(res => {
                
                if(typeof res.result !== 'undefined' && res.result == 'blocked') {
                    let whitelist = getPhishingUrls().filter(url => url === msg.data.hostname);
                    if(whitelist.length) {
                        console.log("case 1")
                        data.blocked = false;
                        return postPhishingData(data);
                    }
                    console.log("case 2")
                    data.blocked = true;
                    return postPhishingData(data);
                }
                console.log("case 3")
                data.blocked = false;
                return postPhishingData(data);
            });
        break;
        case 'setPhishingUrl':
            let urls = getPhishingUrls();
            urls.push(msg.data.hostname);
            setPhishingUrl(urls);
        break;
    }
})



const postPhishingData = (data) => {
    browser.tabs.query({active:true, currentWindow:true}).then((tabs) => { 
        const message = { method: 'phishingCheck', data };
        tabs.forEach(({ id }) => chrome.tabs.sendMessage(id, message)) 
    });
}

const postToContent = (data) => {
    chrome.tabs.query({}, function (tabs) { // TODO think about direct communication with tab
        const message = { method: 'pageMessage', data };
        tabs.forEach(({ id }) => chrome.tabs.sendMessage(id, message)) // Send message to all tabs
    });
}
