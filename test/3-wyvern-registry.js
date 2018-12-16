/* global artifacts:false, it:false, contract:false, assert:false */

const WyvernRegistry = artifacts.require('WyvernRegistry')
const AuthenticatedProxy = artifacts.require('AuthenticatedProxy')
const OwnableDelegateProxy = artifacts.require('OwnableDelegateProxy')
const TestAuthenticatedProxy = artifacts.require('TestAuthenticatedProxy')

const Web3 = require('web3')
const provider = new Web3.providers.HttpProvider('http://localhost:8545')
const web3 = new Web3(provider)

const increaseTime = (addSeconds, callback) => {
  return web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [addSeconds],
    id: 0
  }, callback)
}

contract('WyvernRegistry', (accounts) => {
  it('should be deployed', () => {
    return WyvernRegistry
      .deployed()
      .then(() => {})
  })

  it('should not allow additional grant', () => {
    return WyvernRegistry
      .deployed()
      .then(registry => {
        return registry.grantInitialAuthentication(registry.address).then(() => {
          assert.equal(true, false, 'Should not have succeeded')
        }).catch(err => {
          assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
        })
      })
  })

  it('should have a delegateproxyimpl', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.delegateProxyImplementation().then(ret => {
          assert.equal(ret.length, 42, 'delegateproxyimpl was not set')
        })
      })
  })

  it('should allow proxy registration', () => {
    return WyvernRegistry
      .deployed()
      .then(instance => {
        return instance.registerProxy({from: accounts[3]}).then(() => {
          return instance.proxies(accounts[3]).then(addr => {
            assert.equal(addr.length > 0, true)
          })
        })
      })
  })

  it('should allow proxy registration', () => {
    return WyvernRegistry
      .deployed()
      .then(instance => {
        return instance.registerProxy({from: accounts[2]}).then(() => {
          return instance.proxies(accounts[2]).then(addr => {
            assert.equal(addr.length > 0, true)
          })
        })
      })
  })

  /*
  it('should allow proxy upgrade', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.registerProxy({from: accounts[5]}).then(() => {
          return registryInstance.proxies(accounts[5])
            .then(ret => {
              console.log(ret)
              const contract = new web3.eth.Contract(OwnableDelegateProxy.abi, ret)
              return registryInstance.delegateProxyImplementation().then(impl => {
                console.log('1')
                return contract.methods.upgradeTo(accounts[5]).send({from: accounts[5]}).then(() => {
                  console.log('2')
                  return contract.methods.upgradeTo(impl).send({from: accounts[5]}).then(() => {
                    console.log('3')
                  })
                })
              })
            })
        })
      })
  })
  */

  it('should not allow proxy upgrade to same implementation', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.proxies(accounts[3])
          .then(ret => {
            return registryInstance.delegateProxyImplementation().then(impl => {
              const contract = new web3.eth.Contract(OwnableDelegateProxy.abi, ret)
              return contract.methods.upgradeTo(impl).send({from: accounts[3]}).then(() => {
                assert.equal(true, false, 'Allowed upgrade to same implementation')
              }).catch(err => {
                assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert')
              })
            })
          })
      })
  })

  it('should return proxy type', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.proxies(accounts[3])
          .then(ret => {
            const contract = new web3.eth.Contract(OwnableDelegateProxy.abi, ret)
            return contract.methods.proxyType().call().then(ty => {
              assert.equal(ty, 2, 'Incorrect proxy type')
            })
          })
      })
  })

  it('should not allow proxy update from another account', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.proxies(accounts[3])
          .then(ret => {
            const contract = new web3.eth.Contract(OwnableDelegateProxy.abi, ret)
            return contract.methods.upgradeTo(registryInstance.address).send({from: accounts[1]}).then(() => {
              assert.equal(true, false, 'allowed proxy update from another account')
            }).catch(err => {
              assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert')
            })
          })
      })
  })

  it('should allow start but not end of authentication process', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.startGrantAuthentication(accounts[0]).then(() => {
          return registryInstance.pending.call(accounts[0]).then(r => {
            assert.equal(r.toNumber() > 0, true, 'Invalid timestamp')
            return registryInstance.endGrantAuthentication(accounts[0]).then(() => {
              assert.equal(true, false, 'End of authentication process allowed without time period passing')
            }).catch(err => {
              assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
            })
          })
        })
      })
  })

  it('should not allow start twice', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.startGrantAuthentication(accounts[0]).then(() => {
          assert.equal(true, false, 'Start of authentication process allowed twice')
        }).catch(err => {
          assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
        })
      })
  })

  it('should not allow end without start', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.endGrantAuthentication(accounts[1]).then(() => {
          assert.equal(true, false, 'End of authentication process allowed without start')
        }).catch(err => {
          assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
        })
      })
  })

  it('should allow end after time has passed', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return increaseTime(86400 * 7 * 3, () => {
          return registryInstance.endGrantAuthentication(accounts[0]).then(() => {
            return registryInstance.contracts.call(accounts[0]).then(ret => {
              assert.equal(ret, true, 'Auth was not granted')
              return registryInstance.revokeAuthentication(accounts[0]).then(() => {
                return registryInstance.contracts.call(accounts[0]).then(ret => {
                  assert.equal(ret, false, 'Auth was not revoked')
                })
              })
            })
          })
        })
      })
  })

  it('should allow proxy registration for another user', () => {
    return WyvernRegistry
      .deployed()
      .then(instance => {
        return instance.registerProxyFor(accounts[1]).then(() => {
          return instance.proxies(accounts[1]).then(addr => {
            assert.equal(addr.length > 0, true)
          })
        })
      })
  })

  it('should allow proxy revocation', () => {
    return WyvernRegistry
      .deployed()
      .then(registry => {
        return TestAuthenticatedProxy
          .deployed()
          .then(testProxy => {
            return registry.proxies(accounts[1]).then(addr => {
              return AuthenticatedProxy.at(addr).then(proxy => {
                return proxy.user().then(user => {
                  assert.equal(user, accounts[1])
                  const inst = new web3.eth.Contract(AuthenticatedProxy.abi, addr)
                  return inst.methods.setRevoke(true).send({from: accounts[1]}).then(() => {
                    return inst.methods.revoked().call().then(ret => {
                      assert.equal(ret, true, 'Should be revoked')
                      return inst.methods.setRevoke(false).send({from: accounts[1]}).then(() => {
                        return inst.methods.revoked().call().then(ret => {
                          assert.equal(ret, false, 'Should be unrevoked')
                        })
                      })
                    })
                  })
                })
              })
            })
          })
      })
  })

  it('should not allow revoke from another account', () => {
    return WyvernRegistry
      .deployed()
      .then(registryInstance => {
        return registryInstance.proxies(accounts[3]).then(proxy => {
          const proxyInst = new web3.eth.Contract(AuthenticatedProxy.abi, proxy)
          return proxyInst.methods.setRevoke(true).send({from: accounts[1]}).then(() => {
            assert.equal(true, false, 'Revocation was allowed from another account')
          }).catch(err => {
            assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
          })
        })
      })
  })

  it('should not allow proxy reinitialization', () => {
    return WyvernRegistry
      .deployed()
      .then(registry => {
        return TestAuthenticatedProxy
          .deployed()
          .then(testProxy => {
            return registry.proxies(accounts[1]).then(addr => {
              return AuthenticatedProxy.at(addr).then(proxy => {
                return proxy.user().then(user => {
                  assert.equal(user, accounts[1])
                  const inst = new web3.eth.Contract(AuthenticatedProxy.abi, addr)
                  return inst.methods.initialize(registry.address, registry.address).send({from: accounts[1]}).then(ret => {
                    assert.equal(true, false, 'Should not have succeeded')
                  }).catch(err => {
                    assert.equal(err.message, 'Returned error: VM Exception while processing transaction: revert', 'Incorrect error')
                  })
                })
              })
            })
          })
      })
  })

  it('should allow delegateproxy owner change', () => {
    return WyvernRegistry
      .deployed()
      .then(registry => {
        return TestAuthenticatedProxy
          .deployed()
          .then(testProxy => {
            return registry.proxies(accounts[1]).then(addr => {
              return AuthenticatedProxy.at(addr).then(proxy => {
                return proxy.user().then(user => {
                  assert.equal(user, accounts[1])
                  const inst = new web3.eth.Contract(TestAuthenticatedProxy.abi, testProxy.address)
                  const call = inst.methods.setUser(accounts[4]).encodeABI()
                  return proxy.proxyAssert(testProxy.address, 1, call, {from: accounts[1]}).then(() => {
                    return proxy.user().then(user => {
                      assert.equal(user, accounts[4], 'User was not changed')
                    })
                  })
                })
              })
            })
          })
      })
  })
})
