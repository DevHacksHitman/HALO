"use client";

import {useMemo, useState} from "react";
import type {PermissionRequestParameter} from "@metamask/smart-accounts-kit/actions";
import {
  BASE_MAINNET_CHAIN_ID,
  DEFAULT_MONTHLY_CAP_USDC,
  MONTH_SECONDS,
  createHaloPermissionRequest,
  createSerializableHaloPermissionRequest,
  formatShortAddress,
  isHexAddress,
} from "@/lib/haloPermissions.mjs";
import {getHaloChainProfile} from "@/lib/chainProfiles.mjs";
import {
  buildPermissionCaptureReport,
  formatPermissionCaptureLogs,
} from "@/lib/metaMaskPermissionCapture.mjs";
import {
  buildPermissionContextHandoff,
  formatPermissionContextHandoffLogs,
  redactPermissionCaptureForDisplay,
} from "@/lib/metaMaskPermissionHandoff.mjs";
import {
  buildDependencyDeploymentPlan,
  buildPermissionGrantEnvCommand,
  formatDependencyDeploymentLogs,
  redactDependencyDeploymentPlan,
  serializePermissionGrantForEnv,
  summarizePermissionGrantShape,
} from "@/lib/metaMaskPermissionGrant.mjs";
import {
  classifySmartAccount7702Readiness,
  formatSmartAccount7702ReadinessLogs,
} from "@/lib/metaMask7702Readiness.mjs";

const SELECTED_PROFILE = getClientChainProfile();
const DEFAULT_RELAYER_TARGET = process.env.NEXT_PUBLIC_ONESHOT_RELAYER_TARGET_WALLET_ADDRESS ??
  process.env.NEXT_PUBLIC_HALO_SESSION_ACCOUNT_ADDRESS ??
  "";
const HALO_USDC_ADDRESS = SELECTED_PROFILE.mainnet
  ? SELECTED_PROFILE.usdcAddress
  : process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || SELECTED_PROFILE.usdcAddress;
const HALO_MONTHLY_CAP_USDC = process.env.NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC || DEFAULT_MONTHLY_CAP_USDC;
type PermissionCaptureReport = ReturnType<typeof buildPermissionCaptureReport>;
type PermissionContextHandoff = ReturnType<typeof buildPermissionContextHandoff>;

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: {method: string; params?: unknown[] | Record<string, unknown>}) => Promise<unknown>;
};

function getEthereumProvider() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as typeof window & {ethereum?: EthereumProvider}).ethereum;
}

export function DonorPermissionClient() {
  const [donorAddress, setDonorAddress] = useState("");
  const [chainIdHex, setChainIdHex] = useState("");
  const [relayerTargetAddress, setRelayerTargetAddress] = useState(DEFAULT_RELAYER_TARGET);
  const [capabilitiesStatus, setCapabilitiesStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [readinessStatus, setReadinessStatus] = useState("--");
  const [grantSummary, setGrantSummary] = useState<PermissionCaptureReport | null>(null);
  const [contextHandoff, setContextHandoff] = useState<PermissionContextHandoff | null>(null);
  const [capturedGrantJson, setCapturedGrantJson] = useState("");
  const [dependencyTxs, setDependencyTxs] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[MetaMask] Wallet client ready for donor action.",
    "[SECURITY] Agent session address is an input, no private key enters the browser.",
  ]);

  const canRequest =
    isHexAddress(donorAddress) && isHexAddress(relayerTargetAddress) && chainIdHex === SELECTED_PROFILE.chainIdHex;

  const permissionPreview = useMemo(() => {
    if (!isHexAddress(donorAddress) || !isHexAddress(relayerTargetAddress)) {
      return null;
    }

    return createSerializableHaloPermissionRequest({
      donorAddress,
      relayerTargetAddress,
      usdcToken: HALO_USDC_ADDRESS,
      chainId: SELECTED_PROFILE.chainId,
      monthlyCapUsdc: HALO_MONTHLY_CAP_USDC,
      nowSeconds: 1_766_000_000,
    });
  }, [donorAddress, relayerTargetAddress]);

  const dependencyPlan = useMemo(() => {
    if (!grantSummary) {
      return null;
    }

    return buildDependencyDeploymentPlan({
      dependencies: grantSummary.summary.dependencies,
      deploymentTxs: JSON.stringify(dependencyTxs),
    });
  }, [grantSummary, dependencyTxs]);

  function addLog(line: string) {
    setLogs((current) => [...current.slice(-7), line]);
  }

  async function connectWallet() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      addLog("[NO-GO] MetaMask provider not found.");
      return;
    }

    setIsBusy(true);
    try {
      const accounts = (await ethereum.request({method: "eth_requestAccounts"})) as string[];
      const chain = (await ethereum.request({method: "eth_chainId"})) as string;
      const selected = accounts[0] ?? "";

      setDonorAddress(selected);
      setChainIdHex(chain);
      addLog(`[MetaMask] Connected donor ${formatShortAddress(selected)}.`);
      addLog(`[EVM] Active chain ${chain}.`);
      await check7702Readiness(selected);
    } catch (error) {
      addLog(`[NO-GO] Wallet connect failed: ${readableError(error)}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function switchToSelectedChain() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      addLog("[NO-GO] MetaMask provider not found.");
      return false;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{chainId: SELECTED_PROFILE.chainIdHex}],
      });
    } catch (error) {
      if (!isAddChainError(error)) {
        addLog(`[NO-GO] Chain switch failed: ${readableError(error)}.`);
        return false;
      }

      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SELECTED_PROFILE.chainIdHex,
            chainName: SELECTED_PROFILE.label,
            nativeCurrency: {name: "Ether", symbol: "ETH", decimals: 18},
            rpcUrls: [SELECTED_PROFILE.defaultRpcUrl],
            blockExplorerUrls: [SELECTED_PROFILE.blockExplorerUrl],
          },
        ],
      });
    }

    const chain = (await ethereum.request({method: "eth_chainId"})) as string;
    setChainIdHex(chain);
    addLog(`[EIP-7702] ${SELECTED_PROFILE.label} selected for MetaMask Smart Account flow.`);
    return chain === SELECTED_PROFILE.chainIdHex;
  }

  async function fetchRelayerCapabilities() {
    setCapabilitiesStatus("loading");
    try {
      const response = await fetch(`/api/oneshot/capabilities?profile=${encodeURIComponent(SELECTED_PROFILE.id)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok || !isHexAddress(payload.targetAddress)) {
        throw new Error(payload.error || "1Shot capabilities response did not include targetAddress");
      }

      setRelayerTargetAddress(payload.targetAddress);
      setCapabilitiesStatus("ready");
      addLog(`[1Shot] relayer targetAddress loaded from capabilities: ${formatShortAddress(payload.targetAddress)}.`);
    } catch (error) {
      setCapabilitiesStatus("failed");
      addLog(`[NO-GO] Capabilities lookup failed: ${readableError(error)}.`);
    }
  }

  async function check7702Readiness(address = donorAddress) {
    const ethereum = getEthereumProvider();
    if (!ethereum || !isHexAddress(address)) {
      return;
    }

    try {
      const [{createPublicClient, custom}, chains] = await Promise.all([
        import("viem"),
        import("viem/chains"),
      ]);
      const viemChain = SELECTED_PROFILE.chainId === BASE_MAINNET_CHAIN_ID ? chains.base : chains.baseSepolia;
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: custom(ethereum),
      });
      const accountCode = await publicClient.getCode({address: address as `0x${string}`});
      const report = classifySmartAccount7702Readiness({accountCode});
      setReadinessStatus(report.status);
      for (const line of formatSmartAccount7702ReadinessLogs(report)) {
        addLog(line);
      }
    } catch (error) {
      setReadinessStatus("CHECK_FAILED");
      addLog(`[NO-GO] 7702 readiness check failed: ${readableError(error)}.`);
    }
  }

  async function requestAdvancedPermission() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      addLog("[NO-GO] MetaMask provider not found.");
      return;
    }

    if (!isHexAddress(relayerTargetAddress)) {
      addLog("[NO-GO] Fetch or enter the 1Shot relayer targetAddress first.");
      return;
    }

    setIsBusy(true);
    try {
      let donor = donorAddress;
      if (!isHexAddress(donor)) {
        const accounts = (await ethereum.request({method: "eth_requestAccounts"})) as string[];
        donor = accounts[0] ?? "";
        setDonorAddress(donor);
      }

      if (!isHexAddress(donor)) {
        throw new Error("No donor account selected");
      }

      if (chainIdHex !== SELECTED_PROFILE.chainIdHex) {
        const switched = await switchToSelectedChain();
        if (!switched) {
          return;
        }
      }

      const [{createWalletClient, custom}, chains, {erc7715ProviderActions}] = await Promise.all([
        import("viem"),
        import("viem/chains"),
        import("@metamask/smart-accounts-kit/actions"),
      ]);
      const viemChain = SELECTED_PROFILE.chainId === BASE_MAINNET_CHAIN_ID ? chains.base : chains.baseSepolia;

      const walletClient = createWalletClient({
        chain: viemChain,
        transport: custom(ethereum),
      }).extend(erc7715ProviderActions());

      const request = createHaloPermissionRequest({
        donorAddress: donor,
        relayerTargetAddress,
        usdcToken: HALO_USDC_ADDRESS,
        chainId: SELECTED_PROFILE.chainId,
        monthlyCapUsdc: HALO_MONTHLY_CAP_USDC,
      }) as PermissionRequestParameter;

      addLog("[ERC-7715] Requesting erc20-token-periodic permission.");
      addLog(`[HALO] Cap ${HALO_MONTHLY_CAP_USDC} USDC per ${MONTH_SECONDS / 86400} days.`);

      const grantedPermissions = await walletClient.requestExecutionPermissions([request]);
      const grant = grantedPermissions[0];

      const report = buildPermissionCaptureReport(grant, request);
      const handoff = buildPermissionContextHandoff(report);
      const nextDependencyPlan = buildDependencyDeploymentPlan({dependencies: report.summary.dependencies});
      const grantShape = summarizePermissionGrantShape(grant);
      const nextReadiness = classifySmartAccount7702Readiness({
        authorizationList: grantShape.authorizationListPresent ? (grant as {authorizationList?: unknown[]}).authorizationList : undefined,
        dependencyCount: nextDependencyPlan.dependencyCount,
        dependenciesDeployed: nextDependencyPlan.dependenciesDeployed,
      });
      const serializedGrant = serializePermissionGrantForEnv(grant);
      setGrantSummary(report);
      setContextHandoff(handoff);
      setCapturedGrantJson(serializedGrant);
      setDependencyTxs([]);
      setReadinessStatus(nextReadiness.status);
      for (const line of formatPermissionCaptureLogs(report)) {
        addLog(line);
      }
      for (const line of formatPermissionContextHandoffLogs(handoff)) {
        addLog(line);
      }
      for (const line of formatDependencyDeploymentLogs(nextDependencyPlan)) {
        addLog(line);
      }
      for (const line of formatSmartAccount7702ReadinessLogs(nextReadiness)) {
        addLog(line);
      }
    } catch (error) {
      addLog(`[NO-GO] Permission request failed: ${readableError(error)}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function copyPermissionContext() {
    if (!contextHandoff) {
      return;
    }

    try {
      await copyText(contextHandoff.context);
      addLog("[MetaMask] Full context copied locally. Do not post it publicly.");
    } catch (error) {
      addLog(`[NO-GO] Context copy failed: ${readableError(error)}.`);
    }
  }

  async function copyEstimateCommand() {
    if (!contextHandoff) {
      return;
    }

    try {
      await copyText(contextHandoff.shellCommand);
      addLog("[1Shot] Private Step 11 estimate command copied.");
    } catch (error) {
      addLog(`[NO-GO] Estimate command copy failed: ${readableError(error)}.`);
    }
  }

  async function copyFullGrantJson() {
    if (!capturedGrantJson) {
      return;
    }

    try {
      await copyText(capturedGrantJson);
      addLog("[MetaMask] Full grant JSON copied locally. Do not post it publicly.");
    } catch (error) {
      addLog(`[NO-GO] Grant copy failed: ${readableError(error)}.`);
    }
  }

  async function copyStep17Command() {
    if (!capturedGrantJson) {
      return;
    }

    try {
      await copyText(buildPermissionGrantEnvCommand({grantJson: capturedGrantJson, dependencyTxs}));
      addLog("[MetaMask] Private Step 17 dependency command copied.");
    } catch (error) {
      addLog(`[NO-GO] Step 17 command copy failed: ${readableError(error)}.`);
    }
  }

  async function deployDependencies() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      addLog("[NO-GO] MetaMask provider not found.");
      return;
    }

    if (!dependencyPlan) {
      addLog("[NO-GO] Capture a permission grant before deploying dependencies.");
      return;
    }

    if (!dependencyPlan.dependenciesPresent) {
      addLog("[MetaMask] Permission grant returned no deployable dependencies.");
      return;
    }

    setIsBusy(true);
    try {
      let donor = donorAddress;
      if (!isHexAddress(donor)) {
        const accounts = (await ethereum.request({method: "eth_requestAccounts"})) as string[];
        donor = accounts[0] ?? "";
        setDonorAddress(donor);
      }

      if (!isHexAddress(donor)) {
        throw new Error("No donor account selected");
      }

      if (chainIdHex !== SELECTED_PROFILE.chainIdHex) {
        const switched = await switchToSelectedChain();
        if (!switched) {
          return;
        }
      }

      const nextTxs = [...dependencyTxs];
      for (const deployment of dependencyPlan.deployments) {
        if (deployment.deployed) {
          continue;
        }

        addLog(`[MetaMask] Deploying dependency ${deployment.index} via ${formatShortAddress(deployment.factory)}.`);
        const txHash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: donor,
              to: deployment.tx.to,
              value: deployment.tx.value,
              data: deployment.tx.data,
            },
          ],
        })) as string;
        nextTxs[deployment.index] = txHash;
        setDependencyTxs([...nextTxs]);
        addLog(`[MetaMask] Dependency ${deployment.index} tx ${formatShortHash(txHash)} recorded.`);
      }
    } catch (error) {
      addLog(`[NO-GO] Dependency deployment failed: ${readableError(error)}.`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="permission-console" aria-labelledby="permission-title">
      <div className="permission-header">
        <div>
          <div className="section-kicker">Step 5 live permission</div>
          <h2 id="permission-title">Request MetaMask Advanced Permission.</h2>
        </div>
        <span className={grantSummary ? "permission-status go" : canRequest ? "permission-status go" : "permission-status"}>
          {grantSummary ? "captured" : canRequest ? "ready" : "setup"}
        </span>
      </div>

      <div className="permission-grid">
        <label>
          1Shot relayer target
          <input
            value={relayerTargetAddress}
            onChange={(event) => setRelayerTargetAddress(event.target.value.trim())}
            placeholder="0x..."
            spellCheck={false}
          />
        </label>
        <div className="permission-readout">
          <span>Profile</span>
          <strong>{SELECTED_PROFILE.label}</strong>
          <small>{SELECTED_PROFILE.id}</small>
        </div>
        <div className="permission-readout">
          <span>Token</span>
          <strong>{formatShortAddress(HALO_USDC_ADDRESS)}</strong>
          <small>{SELECTED_PROFILE.chainId === BASE_MAINNET_CHAIN_ID ? "Base mainnet USDC" : "Base Sepolia USDC"}</small>
        </div>
        <div className="permission-readout">
          <span>Allowance</span>
          <strong>$100</strong>
          <small>30-day ERC-20 periodic cap</small>
        </div>
      </div>

      <div className="action-row">
        <button className="secondary-button" type="button" onClick={connectWallet} disabled={isBusy}>
          Connect MetaMask
        </button>
        <button className="secondary-button" type="button" onClick={fetchRelayerCapabilities} disabled={isBusy || capabilitiesStatus === "loading"}>
          Fetch relayer target
        </button>
        <button className="secondary-button" type="button" onClick={switchToSelectedChain} disabled={isBusy}>
          {SELECTED_PROFILE.label}
        </button>
        <button className="primary-button" type="button" onClick={requestAdvancedPermission} disabled={isBusy}>
          Request permission
        </button>
      </div>

      <div className="permission-summary">
        <div>
          <span>Donor</span>
          <strong>{formatShortAddress(donorAddress)}</strong>
        </div>
        <div>
          <span>Chain</span>
          <strong>{chainIdHex || "not connected"}</strong>
        </div>
        <div>
          <span>Relayer</span>
          <strong>{formatShortAddress(relayerTargetAddress)}</strong>
        </div>
        <div>
          <span>Context</span>
          <strong>{grantSummary ? grantSummary.summary.contextPreview : "--"}</strong>
        </div>
        <div>
          <span>Dependencies</span>
          <strong>{dependencyPlan ? `${dependencyPlan.deployedCount}/${dependencyPlan.dependencyCount}` : "--"}</strong>
        </div>
        <div>
          <span>Auth list</span>
          <strong>{grantSummary ? `${grantSummary.summary.authorizationListCount ?? 0}` : "--"}</strong>
        </div>
        <div>
          <span>7702</span>
          <strong>{readinessStatus}</strong>
        </div>
      </div>

      {contextHandoff ? (
        <div className="handoff-panel" aria-label="MetaMask context handoff">
          <div>
            <span>Step 12 handoff</span>
            <strong>{contextHandoff.contextPreview}</strong>
            <small>{contextHandoff.publicRecordingRule}</small>
          </div>
          <div className="handoff-actions">
            <button className="secondary-button" type="button" onClick={copyPermissionContext}>
              Copy context
            </button>
            <button className="secondary-button" type="button" onClick={copyEstimateCommand}>
              Copy estimate command
            </button>
          </div>
        </div>
      ) : null}

      {dependencyPlan ? (
        <div className="handoff-panel" aria-label="MetaMask dependency deployment">
          <div>
            <span>Step 17 dependencies</span>
            <strong>{dependencyPlan.status}</strong>
            <small>
              {dependencyPlan.dependenciesPresent
                ? "Deploy returned dependencies through MetaMask before retrying the 1Shot estimate."
                : "No deployable dependencies were returned by this grant."}
            </small>
          </div>
          <div className="handoff-actions">
            <button className="secondary-button" type="button" onClick={deployDependencies} disabled={isBusy || !dependencyPlan.dependenciesPresent || dependencyPlan.dependenciesDeployed}>
              Deploy dependencies
            </button>
            <button className="secondary-button" type="button" onClick={copyFullGrantJson} disabled={!capturedGrantJson}>
              Copy grant JSON
            </button>
            <button className="secondary-button" type="button" onClick={copyStep17Command} disabled={!capturedGrantJson}>
              Copy Step 17 command
            </button>
          </div>
        </div>
      ) : null}

      <pre className="permission-preview" aria-live="polite">
        {grantSummary
          ? JSON.stringify(
              {
                ...redactPermissionCaptureForDisplay(grantSummary, contextHandoff ?? undefined),
                dependencyDeployment: dependencyPlan ? redactDependencyDeploymentPlan(dependencyPlan) : null,
              },
              null,
              2,
            )
          : permissionPreview
            ? JSON.stringify(permissionPreview, null, 2)
            : "Connect MetaMask and enter a session account to preview the ERC-7715 request."}
      </pre>

      <div className="inline-terminal" aria-label="MetaMask permission logs">
        {logs.map((line, index) => (
          <code key={`${line}-${index}`}>{line}</code>
        ))}
      </div>
    </section>
  );
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String((error as {message: unknown}).message);
  }

  return "unknown error";
}

function isAddChainError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && Number((error as {code: unknown}).code) === 4902;
}

function getClientChainProfile() {
  try {
    return getHaloChainProfile(process.env.NEXT_PUBLIC_HALO_CHAIN_PROFILE || "base-sepolia");
  } catch {
    return getHaloChainProfile("base-sepolia");
  }
}

function formatShortHash(hash: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return "invalid hash";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API unavailable");
  }

  await navigator.clipboard.writeText(value);
}
