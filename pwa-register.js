if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});}
