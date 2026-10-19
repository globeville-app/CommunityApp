/**
 * Request an organization (docs/MILESTONE_4.md, step 3), or edit one you run
 * (?id=). The name, type and neighborhoods of an approved organization wait
 * for the team's review; the description, link and photo change right away.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import {
  ApiError,
  getOrganization,
  listNeighborhoods,
  NeighborhoodRef,
  ORG_TYPES,
  OrgInput,
  OrgType,
  requestOrganization,
  updateOrganization,
  uploadOrganizationPhoto,
} from "../api";
import { useAuth } from "../auth";
import type { Language } from "../i18n";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { PickedPhoto, pickSquarePhoto } from "../photos";
import {
  Avatar,
  BackButton,
  Body,
  Button,
  Caption,
  Choice,
  ErrorMessage,
  Field,
  GlassCard,
  Loading,
  Notice,
  Screen,
  Section,
  TextLink,
  Title,
  styles as ui,
} from "../ui";

// How many search results to show at once.
const MAX_MATCHES = 12;

export default function OrganizationForm() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { language: appLanguage } = useLanguage();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [all, setAll] = useState<NeighborhoodRef[] | null>(null);
  const [loaded, setLoaded] = useState(!editingId);
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [ruleAccepted, setRuleAccepted] = useState(false);
  const [served, setServed] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [writing, setWriting] = useState<Language>(appLanguage);
  const [description, setDescription] = useState("");
  const [showAlt, setShowAlt] = useState(false);
  const [descriptionAlt, setDescriptionAlt] = useState("");
  const [link, setLink] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  // A new request that was sent but whose photo didn't upload: trying again
  // only retries the photo, so the team never gets the request twice.
  const [requestedId, setRequestedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    listNeighborhoods(token)
      .then((data) => setAll(data.neighborhoods))
      .catch((e) => setError(e as ApiError));
    if (!editingId) return;
    getOrganization(token, editingId)
      .then((org) => {
        setName(org.name);
        setOrgType(org.type);
        setRuleAccepted(org.type === "business");
        setServed(org.neighborhoods.map((n) => n.id));
        setWriting(org.language);
        setDescription(org.description);
        setDescriptionAlt(org.description_alt ?? "");
        setShowAlt(!!org.description_alt);
        setLink(org.link ?? "");
        setPhotoUrl(org.photo_url);
      })
      .catch((e) => setError(e as ApiError))
      .finally(() => setLoaded(true));
  }, [token, editingId]);

  if (!all || !loaded) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  if (done) {
    return (
      <Screen>
        <Title>{t("organizations.thanks_title")}</Title>
        <Notice message={t("organizations.thanks")} />
        <Button title={t("organizations.done")} onPress={() => router.back()} />
      </Screen>
    );
  }

  const otherLanguage: Language = writing === "es" ? "en" : "es";
  const needle = search.trim().toLowerCase();
  const matches = needle ? all.filter((n) => n.name.toLowerCase().includes(needle) && !served.includes(n.id)).slice(0, MAX_MATCHES) : [];
  const business = orgType === "business";

  function toggle(neighborhoodId: number) {
    setServed((list) => (list.includes(neighborhoodId) ? list.filter((x) => x !== neighborhoodId) : [...list, neighborhoodId]));
  }

  async function pick() {
    setError(null);
    const picked = await pickSquarePhoto();
    if (picked === "too_large") setError(new ApiError("photo_too_large"));
    else if (picked) setPhoto(picked);
  }

  async function onSubmit() {
    if (!token || !orgType) return;
    const body: OrgInput = {
      name: name.trim(),
      type: orgType,
      neighborhoods: served,
      description: description.trim(),
      description_alt: showAlt ? descriptionAlt.trim() : "",
      language: writing,
      link: link.trim(),
      business_rule_accepted: business ? ruleAccepted : undefined,
    };
    setBusy(true);
    setError(null);
    try {
      const orgId = editingId
        ? (await updateOrganization(token, editingId, body)).id
        : (requestedId ?? (await requestOrganization(token, body)).id);
      if (!editingId) setRequestedId(orgId);
      if (photo) await uploadOrganizationPhoto(token, orgId, photo);
      if (editingId) router.back();
      else setDone(true);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      <Title>{editingId ? t("organizations.edit_title") : t("organizations.request_title")}</Title>
      {editingId ? <Caption>{t("organizations.edit_review_note")}</Caption> : <Caption>{t("organizations.request_intro")}</Caption>}

      <Field label={t("organizations.name_label")} value={name} onChangeText={setName} maxLength={60} />

      <GlassCard>
        <Section>{t("organizations.type_label")}</Section>
        <View style={ui.row}>
          {ORG_TYPES.map((key) => (
            <Choice key={key} label={t(`organizations.types.${key}`)} selected={orgType === key} onPress={() => setOrgType(key)} />
          ))}
        </View>
        {business ? (
          <>
            <Body onGlass>{t("organizations.business_rule")}</Body>
            <Choice label={t("organizations.business_rule_agree")} selected={ruleAccepted} onPress={() => setRuleAccepted(!ruleAccepted)} />
          </>
        ) : null}
      </GlassCard>

      <GlassCard>
        <Section>{t("organizations.neighborhoods_label")}</Section>
        {served.length > 0 ? (
          <View style={ui.row}>
            {served.map((nid) => (
              <Choice key={nid} label={all.find((n) => n.id === nid)?.name ?? ""} selected onPress={() => toggle(nid)} />
            ))}
          </View>
        ) : (
          <Caption onGlass>{t("organizations.neighborhoods_hint")}</Caption>
        )}
        <Field label={t("organizations.neighborhood_search")} icon="search-outline" value={search} onChangeText={setSearch} />
        {matches.length > 0 ? (
          <View style={ui.row}>
            {matches.map((n) => (
              <Choice key={n.id} label={n.name} selected={false} onPress={() => toggle(n.id)} />
            ))}
          </View>
        ) : null}
      </GlassCard>

      <Field
        label={t("organizations.description_label")}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
      />
      {showAlt ? (
        <Field
          label={t(`organizations.description_alt_${otherLanguage}`)}
          value={descriptionAlt}
          onChangeText={setDescriptionAlt}
          multiline
          maxLength={500}
        />
      ) : (
        <TextLink label={t(`post.add_alt_${otherLanguage}`)} onPress={() => setShowAlt(true)} />
      )}
      <Field
        label={t("organizations.link_label")}
        icon="link-outline"
        value={link}
        onChangeText={setLink}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <GlassCard>
        <Section>{t("organizations.photo_label")}</Section>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar uri={photo?.uri ?? photoUrl} initial={name.slice(0, 1).toUpperCase()} size={64} />
          <View style={{ flex: 1 }}>
            <TextLink label={t("organizations.photo_pick")} onPress={pick} />
          </View>
        </View>
      </GlassCard>

      <ErrorMessage message={errorMessage(t, error)} />
      <Button
        title={editingId ? t("post.save_button") : t("organizations.submit")}
        onPress={onSubmit}
        busy={busy}
        disabled={!name.trim() || !orgType || served.length === 0 || (business && !ruleAccepted)}
      />
      <View style={{ height: 24 }} />
    </Screen>
  );
}
