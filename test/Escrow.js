const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender
    let realEstate, escrow
    let result

    beforeEach(async () => {
        // Setup Accounts
        [buyer, seller, inspector, lender] = await ethers.getSigners()

        // Deploy Real Estate
        const RealEstate = await ethers.getContractFactory('RealEstate')
        realEstate = await RealEstate.deploy()

        // Mint NFT
        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS")
        await transaction.wait()

        // Deploy Escrow
        const Escrow = await ethers.getContractFactory("Escrow")
        escrow = await Escrow.deploy(
            lender.address,
            inspector.address,
            seller.address,
            realEstate.address
        )

        // Approve property
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait()

        // List properties
        transaction = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5));
    })

    describe("Deployment", () => {
        it('Returns NFT Address', async () => {
            result = await escrow.nftAddress()
            expect(result).to.be.equal(realEstate.address)
        })
        it('Returns Seller Address', async () => {
            result = await escrow.seller()
            expect(result).to.be.equal(seller.address)
        })
        it('Returns Inspector Address', async () => {
            let result = await escrow.inspector()
            expect(result).to.be.equal(inspector.address)
        })
        it('Returns Lender Address', async () => {
            let result = await escrow.lender()
            expect(result).to.be.equal(lender.address)
        })
    })

    describe("Listing", async () => {
        it('Updates as listed', async () => {
            result = await escrow.isListed(1)
            expect(result).to.be.equal(true)
        })

        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
        })

        it('Returns buyer', async () => {
            result = await escrow.buyer(1)
            expect(result).to.be.equal(buyer.address)
        })

        it('Returns purchase price', async () => {
            result = await escrow.purchasePrice(1)
            expect(result).to.be.equal(tokens(10))
        })

        it('Returns escrow amount', async () => {
            result = await escrow.escrowAmount(1)
            expect(result).to.be.equal(tokens(5))
        })
    });

    describe("Desposits", () => {
        it('Uptades contract balance', async () => {
            transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5)})
            await transaction.wait()
            result = await escrow.getBalance()
            expect(result).to.be.equal(tokens(5))
        })
    })

    describe("Inspection", () => {
        it('Uptades inspection status', async () => {
            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true)
            await transaction.wait()
            result = await escrow.inspectionPassed(1)
            expect(result).to.be.equal(true)
        })
    })

    describe("Approval", () => {
        it('Uptades inspection status', async () => {
            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
            expect(await escrow.approval(1, seller.address)).to.be.equal(true)
            expect(await escrow.approval(1, lender.address)).to.be.equal(true)

        })
    })

    describe('Sale', async () => { 
        beforeEach( async () => {
            let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5)} )
            await transaction.wait()

            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true)
            await transaction.wait()

            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            await lender.sendTransaction({ to: escrow.address, value: tokens(5)})

            transaction = await escrow.connect(seller).finalizeSale(1)
            await transaction.wait()

        })

        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
        })

        it('Uptades balance', async () => {
            expect(await escrow.getBalance()).to.be.equal(0)
        })

    })

})
