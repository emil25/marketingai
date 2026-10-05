type Graph = <T>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string>,
) => Promise<T>;
type Input = { accountId: string; accessToken: string; caption: string; imageUrls: string[] };

/** Provider result is required at every stage; an uploaded container is not a published post. */
export async function publishInstagramImages(
  input: Input,
  graph: Graph,
  pause: () => Promise<void>,
) {
  const { accountId, accessToken, imageUrls, caption } = input;
  if (!imageUrls.length || imageUrls.length > 6)
    throw new Error("Válassz 1–6 képet az Instagram-poszthoz.");
  const mediaPath = `${accountId}/media`;
  const waitForContainer = async (id: string) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      await pause();
      const status = await graph<{ status_code?: string }>("GET", id, {
        fields: "status_code",
        access_token: accessToken,
      });
      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED")
        throw new Error("Az Instagram nem tudta feldolgozni a képeket.");
    }
    throw new Error("Az Instagram képfeldolgozása időtúllépéssel leállt.");
  };
  let containerId: string;
  if (imageUrls.length === 1) {
    const container = await graph<{ id?: string }>("POST", mediaPath, {
      image_url: imageUrls[0],
      caption,
      access_token: accessToken,
    });
    if (!container.id) throw new Error("Az Instagram nem adott médiatároló azonosítót.");
    containerId = container.id;
  } else {
    const children: string[] = [];
    for (const url of imageUrls) {
      const child = await graph<{ id?: string }>("POST", mediaPath, {
        image_url: url,
        is_carousel_item: "true",
        access_token: accessToken,
      });
      if (!child.id) throw new Error("Az Instagram egyik lapja nem készült el.");
      await waitForContainer(child.id);
      children.push(child.id);
    }
    const parent = await graph<{ id?: string }>("POST", mediaPath, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: accessToken,
    });
    if (!parent.id) throw new Error("Az Instagram lapozható tárolója nem készült el.");
    containerId = parent.id;
  }
  await waitForContainer(containerId);
  const result = await graph<{ id?: string }>("POST", `${accountId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  });
  if (!result.id) throw new Error("Az Instagram nem adott külső posztazonosítót.");
  return result.id;
}

export async function publishFacebookImages(input: Input, graph: Graph) {
  if (!input.imageUrls.length || input.imageUrls.length > 6)
    throw new Error("Válassz 1–6 képet a Facebook-poszthoz.");
  const params: Record<string, string> = {
    message: input.caption,
    access_token: input.accessToken,
  };
  for (const [index, url] of input.imageUrls.entries()) {
    const photo = await graph<{ id?: string }>("POST", `${input.accountId}/photos`, {
      url,
      published: "false",
      access_token: input.accessToken,
    });
    if (!photo.id) throw new Error("A Facebook egyik képét nem sikerült feltölteni.");
    params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photo.id });
  }
  const result = await graph<{ id?: string }>("POST", `${input.accountId}/feed`, params);
  if (!result.id) throw new Error("A Facebook nem adott külső posztazonosítót.");
  return result.id;
}
