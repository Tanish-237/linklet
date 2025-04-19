import styled from "styled-components";

const Badge = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: red;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
`;

const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null;

  return <Badge>{count > 9 ? "9+" : count}</Badge>;
};

export default NotificationBadge;
