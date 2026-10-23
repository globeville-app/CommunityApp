/**
 * Post an event, a short guided flow (docs/MILESTONE_2.md):
 *   0. Post as: You / [Organization] (Milestone 4; only for admins of an
 *      approved organization), then which of its neighborhoods
 *   1. What kind of event? (category picker)
 *   2. Got a Partiful link? (optional; prefills the title, may suggest a category)
 *   3. Details
 *   4. Map pin (Milestone 3): tap the map, drag the pin to the meeting spot
 * Editing (?id=) opens straight on Details; the category can still change.
 * "Add a map pin" on a pinless event opens editing on the pin (?step=pin).
 * Times are entered in Denver time.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import {
  ApiError,
  createEvent,
  EventInput,
  Visibility,
  newFormKey,
  getEvent,
  getMyOrganizations,
  getMyProfile,
  LatLng,
  MyOrg,
  NeighborhoodRef,
  partifulPreview,
  updateEvent,
} from "../api";
import { useAuth } from "../auth";
import { categoryLabel, groupOf, useCategories } from "../categories";
import { CategoryChip } from "../components/CategoryChip";
import { CategoryPicker } from "../components/CategoryPicker";
import { DateTimeField } from "../components/DateTimeField";
import type { Language } from "../i18n";
import { denverParts, endServerTime, EVENT_TIME_ZONE, toServerTime } from "../i18n/dates";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { PinMap } from "../maps/PinMap";
import { space } from "../theme";
import {
  BackButton,
  Button,
  Caption,
  Choice,
  ErrorMessage,
  Field,
  GlassCard,
  Intro,
  Loading,
  Notice,
  Screen,
  Section,
  TextLink,
  Title,
} from "../ui";

type Step = "who" | "where" | "category" | "partiful" | "details" | "pin";

// Downtown Denver, if the server can't say where the neighborhood is.
const DENVER: LatLng = { latitude: 39.7392, longitude: -104.9903 };

// An example link, the same in every language.
const VISIBILITIES: Visibility[] = ["neighborhood", "link_only"];
const PARTIFUL_PLACEHOLDER = "https://partiful.com/e/…";

/** Tomorrow's date in Denver, "2026-10-25", as a starting point. */
function tomorrowInDenver() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );
  return parts; // en-CA formats as YYYY-MM-DD
}

export default function EventForm() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { language: appLanguage } = useLanguage();
  const { groups, other, ready } = useCategories();
  const { id, step: startStep } = useLocalSearchParams<{ id?: string; step?: string }>();
  const editingId = id ? Number(id) : null;

  const [step, setStep] = useState<Step>(editingId ? (startStep === "pin" ? "pin" : "details") : "category");
  const [loaded, setLoaded] = useState(!editingId);
  // Sent with the new event: tapping Post twice, or a retry, makes one event.
  const [formKey] = useState(newFormKey);
  // Posting as an organization (new events only): which one, and where.
  const [orgs, setOrgs] = useState<MyOrg[] | null>(editingId ? [] : null);
  const [asOrg, setAsOrg] = useState<MyOrg | null>(null);
  const [orgNeighborhood, setOrgNeighborhood] = useState<NeighborhoodRef | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [partifulUrl, setPartifulUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("neighborhood");
  const [partifulNote, setPartifulNote] = useState<"found" | "not_found" | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // The language the organizer writes in: the app's language for a new
  // event, or the event's own language when editing.
  const [writing, setWriting] = useState<Language>(appLanguage);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(tomorrowInDenver());
  const [start, setStart] = useState("18:00");
  const [hasEnd, setHasEnd] = useState(false);
  const [end, setEnd] = useState("20:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [showAlt, setShowAlt] = useState(false);
  const [titleAlt, setTitleAlt] = useState("");
  const [descriptionAlt, setDescriptionAlt] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(DENVER);
  // A started event's pin can't move (the server refuses it too).
  const [pinLocked, setPinLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // The map opens on the member's neighborhood, unless an organization's
  // neighborhood was already chosen (this can answer after that choice).
  useEffect(() => {
    if (!token) return;
    getMyProfile(token)
      .then((profile) => {
        const home = profile.neighborhood.center;
        if (home) setMapCenter((current) => (current === DENVER ? home : current));
      })
      .catch(() => undefined);
  }, [token]);

  // Admins of an approved organization choose who's posting first.
  useEffect(() => {
    if (!token || editingId) return;
    getMyOrganizations(token)
      .then((data) => {
        const approved = data.organizations.filter((o) => o.status === "approved");
        setOrgs(approved);
        if (approved.length > 0) setStep("who");
      })
      .catch(() => setOrgs([]));
  }, [token, editingId]);

  function chooseWho(org: MyOrg | null) {
    setAsOrg(org);
    if (org && org.neighborhoods.length > 1) {
      setOrgNeighborhood(null);
      setStep("where");
      return;
    }
    chooseWhere(org ? org.neighborhoods[0] : null);
  }

  function chooseWhere(neighborhood: NeighborhoodRef | null) {
    setOrgNeighborhood(neighborhood);
    if (neighborhood?.center) setMapCenter(neighborhood.center);
    setStep("category");
  }

  // Editing: fill the form from the saved event.
  useEffect(() => {
    if (!editingId || !token) return;
    getEvent(token, editingId)
      .then((event) => {
        setCategory(event.category);
        setOtherText(event.category_other ?? "");
        setPartifulUrl(event.partiful_url ?? "");
        setVisibility(event.visibility ?? "neighborhood");
        setWriting(event.language);
        setTitle(event.title);
        const startParts = denverParts(event.starts_at);
        setDate(startParts.date);
        setStart(startParts.time);
        if (event.ends_at) {
          setHasEnd(true);
          setEnd(denverParts(event.ends_at).time);
        }
        setLocation(event.location_text);
        setDescription(event.description);
        setTitleAlt(event.title_alt ?? "");
        setDescriptionAlt(event.description_alt ?? "");
        setShowAlt(!!event.title_alt || !!event.description_alt);
        if (event.latitude !== null && event.longitude !== null) {
          setPin({ latitude: event.latitude, longitude: event.longitude });
          setPinLocked(new Date(event.starts_at).getTime() <= Date.now());
        }
      })
      .catch((e) => setError(e as ApiError))
      .finally(() => setLoaded(true));
  }, [editingId, token]);

  function onCategory(next: string, nextOther: string) {
    setCategory(next);
    setOtherText(nextOther);
    if (suggestion === next) setSuggestion(null);
    setStep(editingId ? "details" : step === "category" && !title ? "partiful" : "details");
  }

  async function onPartifulContinue() {
    const url = partifulUrl.trim();
    if (!url || !token) {
      setStep("details");
      return;
    }
    setBusy(true);
    try {
      const preview = await partifulPreview(token, url);
      if (preview.title) {
        if (!title.trim()) setTitle(preview.title);
        setPartifulNote("found");
      } else {
        setPartifulNote("not_found");
      }
      // A different suggestion is offered, never forced over the choice.
      setSuggestion(preview.suggested_category && preview.suggested_category !== category ? preview.suggested_category : null);
    } catch {
      setPartifulNote("not_found");
    } finally {
      setBusy(false);
      setStep("details");
    }
  }

  async function onSubmit() {
    if (!token || !category) return;
    const body: EventInput = {
      category,
      category_other: category === other ? otherText : "",
      title: title.trim(),
      description: description.trim(),
      language: writing,
      title_alt: showAlt ? titleAlt.trim() : "",
      description_alt: showAlt ? descriptionAlt.trim() : "",
      starts_at: toServerTime(date, start),
      ends_at: hasEnd ? endServerTime(date, start, end) : null,
      location_text: location.trim(),
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
      partiful_url: partifulUrl.trim(),
      visibility,
      ...(asOrg && orgNeighborhood ? { organization: asOrg.id, neighborhood: orgNeighborhood.id } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateEvent(token, editingId, body);
        router.back();
      } else {
        const created = await createEvent(token, body, formKey);
        // On to "Invite people", then the new event.
        router.replace({ pathname: "/invite/[id]", params: { id: String(created.id), fresh: "1" } });
      }
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  if (!ready || !loaded || !orgs) return <Loading />;

  const otherLanguage: Language = writing === "es" ? "en" : "es";

  if (step === "who") {
    return (
      <Screen>
        <BackButton />
        <Title>{t("post.who_title")}</Title>
        <View style={{ gap: space.s }}>
          <Choice label={t("post.as_you")} selected={false} onPress={() => chooseWho(null)} />
          {orgs.map((org) => (
            <Choice key={org.id} label={org.name} selected={false} onPress={() => chooseWho(org)} />
          ))}
        </View>
      </Screen>
    );
  }

  if (step === "where" && asOrg) {
    return (
      <Screen>
        <BackButton />
        <Title>{t("post.where_title")}</Title>
        <Intro>{t("post.where_intro", { name: asOrg.name })}</Intro>
        <View style={{ gap: space.s }}>
          {asOrg.neighborhoods.map((n) => (
            <Choice key={n.id} label={n.name} selected={orgNeighborhood?.id === n.id} onPress={() => chooseWhere(n)} />
          ))}
        </View>
      </Screen>
    );
  }

  if (step === "pin") {
    return (
      <Screen>
        <BackButton />
        <Title>{t("post.pin_title")}</Title>
        <Intro>{pinLocked ? t("post.pin_locked") : t("post.pin_intro")}</Intro>
        <PinMap center={mapCenter} pin={pin} onChange={setPin} locked={pinLocked} />
        <Caption>{t("post.pin_privacy")}</Caption>
        <ErrorMessage message={errorMessage(t, error)} />
        <Button
          title={editingId ? t("post.save_button") : t("post.post_button")}
          onPress={onSubmit}
          busy={busy}
          disabled={!pin || !category || !title.trim() || !location.trim()}
        />
        <TextLink label={t("post.back_to_details")} onPress={() => setStep("details")} />
      </Screen>
    );
  }

  if (step === "category") {
    return (
      <Screen>
        <BackButton />
        <Title>{t("picker.event_title")}</Title>
        <CategoryPicker mode="single" value={category} otherText={otherText} onChange={onCategory} />
      </Screen>
    );
  }

  if (step === "partiful") {
    return (
      <Screen>
        <BackButton />
        <Title>{t("post.partiful_title")}</Title>
        <Intro>{t("post.partiful_intro")}</Intro>
        <Field
          label={t("post.partiful_label")}
          icon="link-outline"
          placeholder={PARTIFUL_PLACEHOLDER}
          value={partifulUrl}
          onChangeText={setPartifulUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button title={t("post.continue")} onPress={onPartifulContinue} busy={busy} />
        <TextLink label={t("post.skip")} onPress={() => setStep("details")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Title>{editingId ? t("post.edit_title") : t("post.details_title")}</Title>
      {asOrg && orgNeighborhood ? (
        <Caption>{t("post.posting_as", { name: asOrg.name, neighborhood: orgNeighborhood.name })}</Caption>
      ) : null}
      {asOrg?.type === "business" ? <Notice message={t("organizations.business_rule")} /> : null}

      <GlassCard>
        <Section>{t("post.category_label")}</Section>
        <View style={styles.row}>
          {category ? (
            <CategoryChip category={category} group={groupOf(groups, category)} otherText={otherText} />
          ) : null}
          <TextLink label={t("post.change_category")} onPress={() => setStep("category")} />
        </View>
        {suggestion ? (
          <Button
            title={t("post.suggested", { category: categoryLabel(t, suggestion) })}
            variant="secondary"
            onPress={() => {
              setCategory(suggestion);
              setOtherText("");
              setSuggestion(null);
            }}
          />
        ) : null}
      </GlassCard>

      {partifulNote ? (
        partifulNote === "found" ? (
          <Notice message={t("post.partiful_found")} />
        ) : (
          <Caption>{t("post.partiful_not_found")}</Caption>
        )
      ) : null}

      <Field label={t("post.title_label")} value={title} onChangeText={setTitle} maxLength={80} />
      <GlassCard>
        <DateTimeField label={t("post.date_label")} mode="date" value={date} onChange={setDate} />
        <DateTimeField label={t("post.start_label")} mode="time" value={start} onChange={setStart} />
        {hasEnd ? (
          <>
            <DateTimeField label={t("post.end_label")} mode="time" value={end} onChange={setEnd} />
            <TextLink label={t("post.remove_end")} onPress={() => setHasEnd(false)} />
          </>
        ) : (
          <TextLink label={t("post.add_end")} onPress={() => setHasEnd(true)} />
        )}
        <Caption onGlass>{t("post.times_note")}</Caption>
      </GlassCard>
      <Field
        label={t("post.location_label")}
        icon="location-outline"
        value={location}
        onChangeText={setLocation}
        maxLength={120}
      />
      <Caption>{t("post.location_hint")}</Caption>
      <Field
        label={t("post.description_label")}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />

      {showAlt ? (
        <>
          <Field
            label={t(`post.alt_title_${otherLanguage}`)}
            value={titleAlt}
            onChangeText={setTitleAlt}
            maxLength={80}
          />
          <Field
            label={t(`post.alt_description_${otherLanguage}`)}
            value={descriptionAlt}
            onChangeText={setDescriptionAlt}
            multiline
            maxLength={2000}
          />
        </>
      ) : (
        <TextLink label={t(`post.add_alt_${otherLanguage}`)} onPress={() => setShowAlt(true)} />
      )}

      {editingId ? (
        <Field
          label={t("post.partiful_label")}
          icon="link-outline"
          value={partifulUrl}
          onChangeText={setPartifulUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      ) : null}

      <GlassCard>
        <Section>{t("post.visibility_label")}</Section>
        <View style={styles.row}>
          {VISIBILITIES.map((option) => (
            <Choice
              key={option}
              label={t(`post.visibility_${option}`)}
              selected={visibility === option}
              onPress={() => setVisibility(option)}
            />
          ))}
        </View>
        <Caption onGlass>{t(`post.visibility_${visibility}_note`)}</Caption>
      </GlassCard>

      <ErrorMessage message={errorMessage(t, error)} />
      <Button
        title={t("post.continue_to_pin")}
        onPress={() => setStep("pin")}
        disabled={!category || !title.trim() || !location.trim()}
      />
      <View style={{ height: space.l }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.s, flexWrap: "wrap" },
});
