# arbitrader

### Installation
```
apt update && apt upgrade -y && apt install git curl -y
git clone https://github.com/aahutsal/arbitrader.git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
source ~/.bashrc
npm i -g npm@latest
nvm i v17
cd arbitrader
git checkout -B dev
git pull origin dev
npm i
npx ts-node src/app.ts --help
```

### Configuration
- Rename `.env.sample` to `.env`
- Change configuration options. To perform actual arbitrages you should include private keys (to access your wallet on a particular blockchain) and API Keys, Secrets and Passwords to access your wallets on CEXes. 
