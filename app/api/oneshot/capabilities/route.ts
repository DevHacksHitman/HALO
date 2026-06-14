import {getHaloChainProfile} from "@/lib/chainProfiles.mjs";
import {getOneShotCapabilities} from "@/lib/oneShot.mjs";
import {selectCapability} from "@/lib/oneShotFeePlan.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileName = url.searchParams.get("profile") || undefined;
  const profile = getHaloChainProfile(profileName);

  try {
    const capabilities = await getOneShotCapabilities([profile.chainId], {
      endpoint: profile.relayerRpcUrl,
      id: 5,
    });
    const capability = selectCapability(capabilities, profile.chainId);

    return Response.json({
      ok: true,
      profile: profile.id,
      chainId: profile.chainId,
      chainLabel: profile.label,
      relayerRpcUrl: profile.relayerRpcUrl,
      usdcAddress: profile.usdcAddress,
      targetAddress: capability.targetAddress ?? null,
      feeCollector: capability.feeCollector ?? null,
      tokens: capability.tokens ?? [],
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        profile: profile.id,
        chainId: profile.chainId,
        chainLabel: profile.label,
        relayerRpcUrl: profile.relayerRpcUrl,
        usdcAddress: profile.usdcAddress,
        error: error instanceof Error ? error.message : "failed to fetch 1Shot capabilities",
      },
      {status: 502},
    );
  }
}
