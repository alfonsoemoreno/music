import type { NowPlaying } from "@music/domain";

export interface MetadataCandidate { source: string; sourceId: string; title: string; artist: string; confidence: number; sourceUrl?: string }
export interface AlbumIdentificationProvider { identify(nowPlaying: NowPlaying): Promise<MetadataCandidate | undefined> }
export interface MetadataResolver { resolve(nowPlaying: NowPlaying): Promise<MetadataCandidate | undefined> }

export class MetadataResolverService implements MetadataResolver {
  constructor(private readonly providers: AlbumIdentificationProvider[]) {}
  async resolve(nowPlaying: NowPlaying): Promise<MetadataCandidate | undefined> {
    const results = await Promise.allSettled(this.providers.map((provider) => provider.identify(nowPlaying)));
    return results
      .flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : [])
      .filter((candidate) => candidate.confidence >= 0.75)
      .sort((a, b) => b.confidence - a.confidence)[0];
  }
}
