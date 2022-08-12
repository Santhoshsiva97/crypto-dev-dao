import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {

  const [ treasuryBalance, setTreasuryBalance ] = useState(0);
  const [ numProposals, setNumProposals ] = useState(0);
  const [ proposals, setProposals ] = useState([]);
  const [ nftBalance, setNftBalance ] = useState(0);
  const [ fakeNFTTokenId, setFakeNFTTokenId ] = useState("");

  const [ walletConnected, setWalletConnected ] = useState(false);
  const [ loading, setLoading ] = useState(false);
  const [ selectTab, setSelectTab ] = useState("");

  const web3ModelRef = useRef();

  const connectWallet = async() => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch(err) {
      console.error(err);
    }
  }

  const getDAOTreasuryBalance = async() => {
    try {

      const provider = await getProviderOrSigner();
      const treasuryBalance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(treasuryBalance.toString());

    } catch(err) {
      console.error(err);
    }
  }

  const numOfProposalCreated = async() => {
    try {

      const provider = await getProviderOrSigner();
      const daoContract = getDAOContractInstance(provider);
      const proposals = await daoContract.numProposals();
      setNumProposals(proposals.toString());

    } catch(err) {
      console.error(err);
    }
  }

  const getUserNFTBalance = async() => {
    try{

      const signer = await getProviderOrSigner(true);
      const nftContract = getNFTContractInstance(signer);
      const tokenBalance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(tokenBalance.toString()));

    } catch(err) {
      console.error(err);
    }
  }

  const createProposal = async() => {
    try{

      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);
      const tx = await daoContract.createProposal(fakeNFTTokenId);
      setLoading(true);
      await tx.wait();
      numOfProposalCreated();
      setLoading(false);

    } catch(err) {
      console.error(err);
    }
  }

  const fetchProposalById = async(id) => {
    try {

      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.tokenIds.toString(),
        deadline: new Date((proposal.deadline).toString() * 1000),
        yayVotes: proposal.yay.toString(),
        nayVotes: proposal.nay.toString(),
        executed: proposal.excuted,
      }
      return parsedProposal;

    } catch(err) {
      console.error(err);
    }
  }

  const fetchAllProposal = async() => {
    try {

      const totalProposals = [];
      for(let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        totalProposals.push(proposal);
      }
      setProposals(totalProposals);
      return totalProposals;

    } catch(err) {
      console.error(err);
    }
  }

  const voteOnProposal = async(proposalId, _vote) => {
    try {

      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);
      const vote = _vote == 'YAY' ? 0 : 1
      const tx = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposal();

    } catch(err) {
      console.error(err);
    }
  }

  const executeProposal = async(proposalId) => {
    try {

      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);
      const tx = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposal();

    } catch(err) {
      console.error(err);
    }
  }

  const getProviderOrSigner = async(needSigner = false) => {
    const provider = await web3ModelRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if(chainId != 4) {
      window.alert("Change network to rinkeby");
      throw new error("Change network to rinkeby");
    }

    if(needSigner) {
      const signer = await web3Provider.getSigner();
      return signer;
    }
    return web3Provider; 
  }

  const getDAOContractInstance = (signerOrProvider) => {
    return new Contract(
     CRYPTODEVS_DAO_CONTRACT_ADDRESS,
     CRYPTODEVS_DAO_ABI,
     signerOrProvider 
    )
  }

  const getNFTContractInstance = (signerOrProvider) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      signerOrProvider
    )
  }

  useEffect(() => {

    if(!walletConnected) {
      web3ModelRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        numOfProposalCreated();
      }).catch((err) => {
        console.error(err);
      });

    }
  }, [walletConnected]);

  useEffect(() => {
    if(selectTab === 'View Proposals') {
     fetchAllProposal(); 
    }
  }, [selectTab]);

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // Renders the 'Create Proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNFTTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // Renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );

}