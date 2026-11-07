(function(){
  const button=document.getElementById('installAppButton');
  const dialog=document.getElementById('installHelp');
  let installPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  function updateButton(){if(button)button.hidden=standalone()}
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateButton()});
  window.addEventListener('appinstalled',()=>{installPrompt=null;updateButton();if(dialog)dialog.hidden=true});
  window.installStudyApp=async function(){if(standalone()){if(dialog)dialog.hidden=true;return}if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==='accepted'){installPrompt=null;updateButton()}return}if(dialog)dialog.hidden=false};
  window.closeInstallHelp=function(){if(dialog)dialog.hidden=true};
  updateButton();
})();
