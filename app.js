let deferredPrompt = null;
let model = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA можно установить!');
});

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log('User choice:', choice.outcome);
        deferredPrompt = null;
    }
}

async function loadModel() {
    if (!model) {
        model = await mobilenet.load({ version: 2, alpha: 0.25, modelUrl: './model/model.json' });
        console.log('Модель загружена');
    }
}

const input = document.getElementById('imageInput');
const preview = document.getElementById('preview');
input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
    }
});

document.getElementById('recognizeBtn').addEventListener('click', async () => {
    if (!preview.src) return alert('Выберите изображение!');
    await loadModel();
    const predictions = await model.classify(preview);
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = predictions.map(p => `${p.className}: ${(p.probability*100).toFixed(2)}%`).join('<br>');
});
