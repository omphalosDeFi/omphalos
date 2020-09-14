const OmphalosPolicy = artifacts.require('OmphalosPolicy.sol');
const MockOmphalos = artifacts.require('MockOmphalos.sol');
const MockOracle = artifacts.require('MockOracle.sol');

const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const BigNumber = web3.BigNumber;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let omphalosPolicy, mockOmphalos, mockMarketOracle, mockCpiOracle;
let r, prevEpoch, prevTime;
let deployer, user, orchestrator;

const MAX_RATE = (new BigNumber('1')).mul(10 ** 6 * 10 ** 18);
const MAX_SUPPLY = (new BigNumber(2).pow(255).minus(1)).div(MAX_RATE);
const BASE_CPI = new BigNumber(100e18);
const INITIAL_CPI = new BigNumber(251.712e18);
const INITIAL_CPI_25P_MORE = INITIAL_CPI.mul(1.25).dividedToIntegerBy(1);
const INITIAL_CPI_25P_LESS = INITIAL_CPI.mul(0.77).dividedToIntegerBy(1);
const INITIAL_RATE = INITIAL_CPI.mul(1e18).dividedToIntegerBy(BASE_CPI);
const INITIAL_RATE_30P_MORE = INITIAL_RATE.mul(1.3).dividedToIntegerBy(1);
const INITIAL_RATE_30P_LESS = INITIAL_RATE.mul(0.7).dividedToIntegerBy(1);
const INITIAL_RATE_5P_MORE = INITIAL_RATE.mul(1.05).dividedToIntegerBy(1);
const INITIAL_RATE_5P_LESS = INITIAL_RATE.mul(0.95).dividedToIntegerBy(1);
const INITIAL_RATE_60P_MORE = INITIAL_RATE.mul(1.6).dividedToIntegerBy(1);
const INITIAL_RATE_2X = INITIAL_RATE.mul(2);

async function setupContracts () {
  await chain.waitForSomeTime(86400);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  orchestrator = accounts[2];
  mockOmphalos = await MockOmphalos.new();
  mockMarketOracle = await MockOracle.new('MarketOracle');
  mockCpiOracle = await MockOracle.new('CpiOracle');
  omphalosPolicy = await OmphalosPolicy.new();
  await omphalosPolicy.sendTransaction({
    data: encodeCall('initialize', ['address', 'address', 'uint256'], [deployer, mockOmphalos.address, BASE_CPI.toString()]),
    from: deployer
  });
  await omphalosPolicy.setMarketOracle(mockMarketOracle.address);
  await omphalosPolicy.setCpiOracle(mockCpiOracle.address);
  await omphalosPolicy.setOrchestrator(orchestrator);
}

async function setupContractsWithOpenRebaseWindow () {
  await setupContracts();
  await omphalosPolicy.setRebaseTimingParameters(60, 0, 60);
}

async function mockExternalData (rate, cpi, uFragSupply, rateValidity = true, cpiValidity = true) {
  await mockMarketOracle.storeData(rate);
  await mockMarketOracle.storeValidity(rateValidity);
  await mockCpiOracle.storeData(cpi);
  await mockCpiOracle.storeValidity(cpiValidity);
  await mockOmphalos.storeSupply(uFragSupply);
}

contract('OmphalosPolicy', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:initialize', async function (accounts) {
  describe('initial values set correctly', function () {
    before('setup OmphalosPolicy contract', setupContracts);

    it('deviationThreshold', async function () {
      (await omphalosPolicy.deviationThreshold.call()).should.be.bignumber.eq(0.05e18);
    });
    it('rebaseLag', async function () {
      (await omphalosPolicy.rebaseLag.call()).should.be.bignumber.eq(30);
    });
    it('minRebaseTimeIntervalSec', async function () {
      (await omphalosPolicy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq(24 * 60 * 60);
    });
    it('epoch', async function () {
      (await omphalosPolicy.epoch.call()).should.be.bignumber.eq(0);
    });
    it('rebaseWindowOffsetSec', async function () {
      (await omphalosPolicy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq(72000);
    });
    it('rebaseWindowLengthSec', async function () {
      (await omphalosPolicy.rebaseWindowLengthSec.call()).should.be.bignumber.eq(900);
    });
    it('should set owner', async function () {
      expect(await omphalosPolicy.owner.call()).to.eq(deployer);
    });
    it('should set reference to omphalos', async function () {
      expect(await omphalosPolicy.uFrags.call()).to.eq(mockOmphalos.address);
    });
  });
});

contract('OmphalosPolicy:setMarketOracle', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should set marketOracle', async function () {
    await omphalosPolicy.setMarketOracle(deployer);
    expect(await omphalosPolicy.marketOracle.call()).to.eq(deployer);
  });
});

contract('Omphalos:setMarketOracle:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setMarketOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setMarketOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:setCpiOracle', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should set cpiOracle', async function () {
    await omphalosPolicy.setCpiOracle(deployer);
    expect(await omphalosPolicy.cpiOracle.call()).to.eq(deployer);
  });
});

contract('Omphalos:setCpiOracle:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setCpiOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setCpiOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:setOrchestrator', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should set orchestrator', async function () {
    await omphalosPolicy.setOrchestrator(user, {from: deployer});
    expect(await omphalosPolicy.orchestrator.call()).to.eq(user);
  });
});

contract('Omphalos:setOrchestrator:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setOrchestrator(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setOrchestrator(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:setDeviationThreshold', async function (accounts) {
  let prevThreshold, threshold;
  before('setup OmphalosPolicy contract', async function () {
    await setupContracts();
    prevThreshold = await omphalosPolicy.deviationThreshold.call();
    threshold = prevThreshold.plus(0.01e18);
    await omphalosPolicy.setDeviationThreshold(threshold);
  });

  it('should set deviationThreshold', async function () {
    (await omphalosPolicy.deviationThreshold.call()).should.be.bignumber.eq(threshold);
  });
});

contract('Omphalos:setDeviationThreshold:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setDeviationThreshold(0, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setDeviationThreshold(0, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:setRebaseLag', async function (accounts) {
  let prevLag;
  before('setup OmphalosPolicy contract', async function () {
    await setupContracts();
    prevLag = await omphalosPolicy.rebaseLag.call();
  });

  describe('when rebaseLag is more than 0', async function () {
    it('should setRebaseLag', async function () {
      const lag = prevLag.plus(1);
      await omphalosPolicy.setRebaseLag(lag);
      (await omphalosPolicy.rebaseLag.call()).should.be.bignumber.eq(lag);
    });
  });

  describe('when rebaseLag is 0', async function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.setRebaseLag(0))
      ).to.be.true;
    });
  });
});

contract('Omphalos:setRebaseLag:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setRebaseLag(1, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setRebaseLag(1, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:setRebaseTimingParameters', async function (accounts) {
  before('setup OmphalosPolicy contract', async function () {
    await setupContracts();
  });

  describe('when interval=0', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.setRebaseTimingParameters(0, 0, 0))
      ).to.be.true;
    });
  });

  describe('when offset > interval', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.setRebaseTimingParameters(300, 3600, 300))
      ).to.be.true;
    });
  });

  describe('when params are valid', function () {
    it('should setRebaseTimingParameters', async function () {
      await omphalosPolicy.setRebaseTimingParameters(600, 60, 300);
      (await omphalosPolicy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq(600);
      (await omphalosPolicy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq(60);
      (await omphalosPolicy.rebaseWindowLengthSec.call()).should.be.bignumber.eq(300);
    });
  });
});

contract('Omphalos:setRebaseTimingParameters:accessControl', function (accounts) {
  before('setup OmphalosPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setRebaseTimingParameters(600, 60, 300, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(omphalosPolicy.setRebaseTimingParameters(600, 60, 300, { from: user }))
    ).to.be.true;
  });
});

contract('OmphalosPolicy:Rebase:accessControl', async function (accounts) {
  beforeEach('setup OmphalosPolicy contract', async function () {
    await setupContractsWithOpenRebaseWindow();
    await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
    await chain.waitForSomeTime(60);
  });

  describe('when rebase called by orchestrator', function () {
    it('should succeed', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });

  describe('when rebase called by non-orchestrator', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: user}))
      ).to.be.true;
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when minRebaseTimeIntervalSec has NOT passed since the previous rebase', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1010);
      await chain.waitForSomeTime(60);
      await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should fail', async function () {
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is within deviationThreshold', function () {
    before(async function () {
      await omphalosPolicy.setRebaseTimingParameters(60, 0, 60);
    });

    it('should return 0', async function () {
      await mockExternalData(INITIAL_RATE.minus(1), INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE.plus(1), INITIAL_CPI, 1000);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_MORE.minus(2), INITIAL_CPI, 1000);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
      await chain.waitForSomeTime(60);

      await mockExternalData(INITIAL_RATE_5P_LESS.plus(2), INITIAL_CPI, 1000);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
      await chain.waitForSomeTime(60);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is more than MAX_RATE', function () {
    it('should return same supply delta as delta for MAX_RATE', async function () {
      // Any exchangeRate >= (MAX_RATE=100x) would result in the same supply increase
      await mockExternalData(MAX_RATE, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await omphalosPolicy.rebase({from: orchestrator});
      const supplyChange = r.logs[0].args.requestedSupplyAdjustment;

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.add(1e17), INITIAL_CPI, 1000);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);

      await chain.waitForSomeTime(60);

      await mockExternalData(MAX_RATE.mul(2), INITIAL_CPI, 1000);
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when omphalos grows beyond MAX_SUPPLY', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY.minus(1));
      await chain.waitForSomeTime(60);
    });

    it('should apply SupplyAdjustment {MAX_SUPPLY - totalSupply}', async function () {
      // Supply is MAX_SUPPLY-1, exchangeRate is 2x; resulting in a new supply more than MAX_SUPPLY
      // However, supply is ONLY increased by 1 to MAX_SUPPLY
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(1);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when omphalos supply equals MAX_SUPPLY and rebase attempts to grow', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY);
      await chain.waitForSomeTime(60);
    });

    it('should not grow', async function () {
      r = await omphalosPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the market oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the market oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the cpi oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the cpi oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('positive rate and no change CPI', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000);
      await omphalosPolicy.setRebaseTimingParameters(60, 0, 60);
      await chain.waitForSomeTime(60);
      await omphalosPolicy.rebase({from: orchestrator});
      await chain.waitForSomeTime(59);
      prevEpoch = await omphalosPolicy.epoch.call();
      prevTime = await omphalosPolicy.lastRebaseTimestampSec.call();
      await mockExternalData(INITIAL_RATE_60P_MORE, INITIAL_CPI, 1010);
      r = await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should increment epoch', async function () {
      const epoch = await omphalosPolicy.epoch.call();
      expect(prevEpoch.plus(1).eq(epoch));
    });

    it('should update lastRebaseTimestamp', async function () {
      const time = await omphalosPolicy.lastRebaseTimestampSec.call();
      expect(time.minus(prevTime).eq(60)).to.be.true;
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.eq(prevEpoch.plus(1))).to.be.true;
      log.args.exchangeRate.should.be.bignumber.eq(INITIAL_RATE_60P_MORE);
      log.args.cpi.should.be.bignumber.eq(INITIAL_CPI);
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(20);
    });

    it('should call getData from the market oracle', async function () {
      const fnCalled = mockMarketOracle.FunctionCalled().formatter(r.receipt.logs[2]);
      expect(fnCalled.args.instanceName).to.eq('MarketOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(omphalosPolicy.address);
    });

    it('should call getData from the cpi oracle', async function () {
      const fnCalled = mockCpiOracle.FunctionCalled().formatter(r.receipt.logs[0]);
      expect(fnCalled.args.instanceName).to.eq('CpiOracle');
      expect(fnCalled.args.functionName).to.eq('getData');
      expect(fnCalled.args.caller).to.eq(omphalosPolicy.address);
    });

    it('should call uFrag Rebase', async function () {
      prevEpoch = await omphalosPolicy.epoch.call();
      const fnCalled = mockOmphalos.FunctionCalled().formatter(r.receipt.logs[4]);
      expect(fnCalled.args.instanceName).to.eq('Omphalos');
      expect(fnCalled.args.functionName).to.eq('rebase');
      expect(fnCalled.args.caller).to.eq(omphalosPolicy.address);
      const fnArgs = mockOmphalos.FunctionArguments().formatter(r.receipt.logs[5]);
      const parsedFnArgs = Object.keys(fnArgs.args).reduce((m, k) => {
        return fnArgs.args[k].map(d => d.toNumber()).concat(m);
      }, [ ]);
      expect(parsedFnArgs).to.include.members([prevEpoch.toNumber(), 20]);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('negative rate', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_LESS, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(-10);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi increases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_MORE, 1000);
      await chain.waitForSomeTime(60);
      await omphalosPolicy.setDeviationThreshold(0);
      r = await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(-6);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi decreases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_LESS, 1000);
      await chain.waitForSomeTime(60);
      await omphalosPolicy.setDeviationThreshold(0);
      r = await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(9);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  before('setup OmphalosPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('rate=TARGET_RATE', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      await omphalosPolicy.setDeviationThreshold(0);
      await chain.waitForSomeTime(60);
      r = await omphalosPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with 0 requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(0);
    });
  });
});

contract('OmphalosPolicy:Rebase', async function (accounts) {
  let rbTime, rbWindow, minRebaseTimeIntervalSec, now, prevRebaseTime, nextRebaseWindowOpenTime,
    timeToWait, lastRebaseTimestamp;

  beforeEach('setup OmphalosPolicy contract', async function () {
    await setupContracts();
    await omphalosPolicy.setRebaseTimingParameters(86400, 72000, 900);
    rbTime = await omphalosPolicy.rebaseWindowOffsetSec.call();
    rbWindow = await omphalosPolicy.rebaseWindowLengthSec.call();
    minRebaseTimeIntervalSec = await omphalosPolicy.minRebaseTimeIntervalSec.call();
    now = new BigNumber(await chain.currentTime());
    prevRebaseTime = now.minus(now.mod(minRebaseTimeIntervalSec)).plus(rbTime);
    nextRebaseWindowOpenTime = prevRebaseTime.plus(minRebaseTimeIntervalSec);
  });

  describe('when its 5s after the rebase window closes', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.minus(now).plus(rbWindow).plus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await omphalosPolicy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s before the rebase window opens', function () {
    it('should fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.minus(now).minus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await omphalosPolicy.inRebaseWindow.call()).to.be.false;
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when its 5s after the rebase window opens', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.minus(now).plus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await omphalosPolicy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await omphalosPolicy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
    });
  });

  describe('when its 5s before the rebase window closes', function () {
    it('should NOT fail', async function () {
      timeToWait = nextRebaseWindowOpenTime.minus(now).plus(rbWindow).minus(5);
      await chain.waitForSomeTime(timeToWait.toNumber());
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      expect(await omphalosPolicy.inRebaseWindow.call()).to.be.true;
      expect(
        await chain.isEthException(omphalosPolicy.rebase({from: orchestrator}))
      ).to.be.false;
      lastRebaseTimestamp = await omphalosPolicy.lastRebaseTimestampSec.call();
      expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
    });
  });
});
