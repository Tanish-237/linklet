import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../api/apiClient";
import { calculateAcademicYear } from "../../../utlis/academicYear";

const YEAR_LABELS = {
  First: "1st year",
  Second: "2nd year",
  Third: "3rd year",
  Final: "Final year",
  Alumni: "Alumni",
};

const joinedFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

/**
 * The other person's details in a 1:1 chat. Chat participants only carry
 * name/username/avatar, so the full profile (year, branch, semester, …) is
 * fetched here — previously every field read from the thin participant
 * object and showed "N/A" (and a hard-coded "CSE" branch for everyone).
 */
const ContactDetails = ({ participant }) => {
  const username = participant?.username;
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => (await apiClient.get(`/profile/${encodeURIComponent(username)}`)).data?.data,
    enabled: Boolean(username),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="contact-details" aria-busy="true" aria-label="Loading details">
        <div className="contact-card is-skeleton" style={{ height: 72 }} />
        <div className="contact-card is-skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="contact-details">
        <div className="contact-card contact-card-error">
          <p>Couldn&apos;t load {participant?.fullName || "this person"}&apos;s details.</p>
          <button type="button" className="chat-media-retry" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const academicYear = profile.userType === "Alumni" ? "Alumni" : profile.year || calculateAcademicYear(profile.email);
  const branch = profile.department || profile.branch?.name || (typeof profile.branch === "string" ? profile.branch : "");
  const classInfo = [
    profile.semester ? `Semester ${profile.semester}` : null,
    profile.section ? `Section ${profile.section}${profile.subSection ? ` (${profile.subSection})` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows = [
    academicYear && { icon: "school", label: "Year", value: YEAR_LABELS[academicYear] || academicYear },
    branch && { icon: "account_balance", label: "Branch", value: branch },
    classInfo && { icon: "class", label: "Class", value: classInfo },
    profile.email && {
      icon: "mail_outline",
      label: "Email",
      value: <a href={`mailto:${profile.email}`}>{profile.email}</a>,
    },
    profile.phoneNumber && {
      icon: "call",
      label: "Phone",
      value: <a href={`tel:${profile.phoneNumber.replace(/\s+/g, "")}`}>{profile.phoneNumber}</a>,
    },
    profile.createdAt && { icon: "event", label: "Joined", value: joinedFormatter.format(new Date(profile.createdAt)) },
  ].filter(Boolean);

  return (
    <div className="contact-details">
      <div className="contact-card">
        <h5 className="contact-card-title">About</h5>
        <p className={profile.bio ? "contact-bio" : "contact-bio is-empty"}>
          {profile.bio || "No bio yet."}
        </p>
        {profile.userType && (
          <span className={`contact-role ${profile.userType === "Alumni" ? "is-alumni" : ""}`}>
            {profile.userType}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="contact-card">
          <h5 className="contact-card-title">Details</h5>
          <dl className="contact-rows">
            {rows.map((row) => (
              <div key={row.label} className="contact-row">
                <span className="material-icons" aria-hidden="true">{row.icon}</span>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {Array.isArray(profile.skills) && profile.skills.length > 0 && (
        <div className="contact-card">
          <h5 className="contact-card-title">Skills</h5>
          <div className="contact-skills">
            {profile.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      )}

      <Link to={`/profile/${profile.username}`} className="contact-profile-link">
        View full profile
        <span className="material-icons" aria-hidden="true">arrow_forward</span>
      </Link>
    </div>
  );
};

export default ContactDetails;
